"""AI Accessibility Assistant - backend.

Fast + accurate + unlimited sustained use:
- All inference local (no vendor quotas, no per-query cost)
- Bounded TTL-LRU cache (flat memory over hours)
- Semaphore-gated inference (burst-safe)
- Temp files unlinked per request (flat disk)
- /metrics endpoint for observability during long sessions
"""
import asyncio
import hashlib
import io
import os
import tempfile
import time
import wave
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import edge_tts
import numpy as np
import psutil
import torch
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from faster_whisper import WhisperModel
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
from transformers import AutoModelForCausalLM, AutoProcessor

from signbook import match_phrase

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TORCH_THREADS = min(8, os.cpu_count() or 4)
torch.set_num_threads(TORCH_THREADS)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WHISPER_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small" if DEVICE == "cpu" else "medium")
WHISPER_COMPUTE = "float16" if DEVICE == "cuda" else "int8"
DEFAULT_VOICE = os.environ.get("TTS_VOICE", "en-IN-NeerjaNeural")
FLORENCE_TASK = "<CAPTION>"
MAX_TTS_CHARS = 2000

# ---------------------------------------------------------------------------
# Model loading (once, at import; server only accepts traffic after warmup)
# ---------------------------------------------------------------------------
print(f"[startup] device={DEVICE} torch_threads={TORCH_THREADS}")
_t0 = time.perf_counter()

processor = AutoProcessor.from_pretrained("microsoft/Florence-2-base", trust_remote_code=True)
caption_model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Florence-2-base",
    trust_remote_code=True,
    torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
)
if DEVICE == "cuda":
    caption_model = caption_model.to("cuda")

ocr_engine = RapidOCR()
stt_model = WhisperModel(WHISPER_SIZE, device=DEVICE, compute_type=WHISPER_COMPUTE)
print(f"[startup] models loaded in {time.perf_counter() - _t0:.1f}s")

executor = ThreadPoolExecutor(max_workers=2)


# ---------------------------------------------------------------------------
# Sustained-use guards
# ---------------------------------------------------------------------------
class TTLLRUCache:
    """Bounded by count AND age: memory stays flat over hours of use."""

    def __init__(self, maxsize: int = 32, ttl_seconds: float = 1800.0):
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._data: OrderedDict[str, tuple[float, dict]] = OrderedDict()

    def get(self, key: str):
        entry = self._data.get(key)
        if entry is None:
            return None
        inserted_at, value = entry
        if time.time() - inserted_at > self._ttl:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: dict) -> None:
        self._data[key] = (time.time(), value)
        self._data.move_to_end(key)
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)

    def __len__(self) -> int:
        return len(self._data)


IMAGE_CACHE = TTLLRUCache()
INFERENCE_SEM = asyncio.Semaphore(2)
START_TIME = time.time()
REQUEST_COUNT = 0
_PROC = psutil.Process(os.getpid())

app = FastAPI(title="AI Accessibility Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def count_requests(request, call_next):
    global REQUEST_COUNT
    REQUEST_COUNT += 1
    return await call_next(request)


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------
def _downscale(image: Image.Image, max_edge: int = 1500) -> Image.Image:
    w, h = image.size
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return image


def _caption(image: Image.Image) -> str:
    inputs = processor(text=FLORENCE_TASK, images=image, return_tensors="pt")
    if DEVICE == "cuda":
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
        inputs["pixel_values"] = inputs["pixel_values"].to(dtype=torch.float16)
    with torch.no_grad():
        generated = caption_model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=64,
            num_beams=1,
            do_sample=False,
        )
    raw = processor.batch_decode(generated, skip_special_tokens=False)[0]
    parsed = processor.post_process_generation(raw, task=FLORENCE_TASK)
    return parsed[FLORENCE_TASK].strip()


def _ocr(image: Image.Image) -> str:
    result, _elapse = ocr_engine(np.array(image))
    if not result:
        return ""
    return " ".join(item[1] for item in result).strip()


def _transcribe(path: str) -> tuple[str, str]:
    segments, info = stt_model.transcribe(path, beam_size=1, vad_filter=True)
    text = " ".join(seg.text for seg in segments).strip()
    return text, info.language


def _warmup() -> None:
    t0 = time.perf_counter()
    dummy = Image.new("RGB", (224, 224), (120, 120, 120))
    _caption(dummy)
    _ocr(dummy)

    silent = os.path.join(tempfile.gettempdir(), f"warmup_{uuid4().hex}.wav")
    with wave.open(silent, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x00" * 16000)
    _transcribe(silent)
    os.unlink(silent)
    print(f"[startup] warmup done in {time.perf_counter() - t0:.1f}s")


_warmup()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/metrics")
def metrics():
    return {
        "rss_mb": round(_PROC.memory_info().rss / 1e6, 1),
        "uptime_s": round(time.time() - START_TIME, 1),
        "requests_served": REQUEST_COUNT,
        "cache_entries": len(IMAGE_CACHE),
        "device": DEVICE,
        "whisper_model": WHISPER_SIZE,
    }


@app.get("/health")
def health():
    return {"status": "ok", "device": DEVICE}


@app.post("/describe-image")
async def describe_image(file: UploadFile = File(...)):
    t0 = time.perf_counter()
    contents = await file.read()
    if not contents:
        return JSONResponse(status_code=422, content={"error": "Empty file uploaded"})

    digest = hashlib.sha256(contents).hexdigest()
    cached = IMAGE_CACHE.get(digest)
    if cached is not None:
        return JSONResponse(content={**cached, "cached": True,
                                      "elapsed_s": round(time.perf_counter() - t0, 2)})

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        return JSONResponse(status_code=422, content={"error": "Not a valid image file"})
    image = _downscale(image)

    loop = asyncio.get_running_loop()
    async with INFERENCE_SEM:
        caption, ocr_text = await asyncio.gather(
            loop.run_in_executor(executor, _caption, image),
            loop.run_in_executor(executor, _ocr, image),
        )

    full = f"{caption}. Text found: {ocr_text}" if ocr_text else caption
    payload = {
        "caption": caption,
        "extracted_text": ocr_text or "No text detected",
        "full_description": full,
        "cached": False,
        "elapsed_s": round(time.perf_counter() - t0, 2),
    }
    IMAGE_CACHE.set(digest, payload)
    return JSONResponse(content=payload)


@app.post("/speech-to-text")
async def speech_to_text(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        return JSONResponse(status_code=422, content={"error": "Empty audio uploaded"})

    tmp = os.path.join(tempfile.gettempdir(), f"stt_{uuid4().hex}.webm")
    with open(tmp, "wb") as fh:
        fh.write(contents)
    try:
        loop = asyncio.get_running_loop()
        async with INFERENCE_SEM:
            text, language = await loop.run_in_executor(executor, _transcribe, tmp)
        if not text:
            return JSONResponse(status_code=422, content={"error": "No speech detected in audio"})
        return JSONResponse(content={"transcription": text, "language": language})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Transcription failed: {e}"})
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.post("/speech-to-sign")
async def speech_to_sign(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        return JSONResponse(status_code=422, content={"error": "Empty audio chunk"})

    tmp = os.path.join(tempfile.gettempdir(), f"sign_{uuid4().hex}.webm")
    with open(tmp, "wb") as fh:
        fh.write(contents)
    try:
        loop = asyncio.get_running_loop()
        async with INFERENCE_SEM:
            transcript, _lang = await loop.run_in_executor(executor, _transcribe, tmp)
        if not transcript:
            return JSONResponse(content={"transcript": "", "phrase": None, "match_score": 0.0})

        phrase, score = match_phrase(transcript)
        return JSONResponse(content={
            "transcript": transcript,
            "phrase": None if phrase is None else {
                "phrase_id": phrase.phrase_id,
                "text": phrase.text,
                "gloss": list(phrase.gloss),
                "clip": phrase.clip,
            },
            "match_score": round(score, 3),
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Sign translation failed: {e}"})
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@app.post("/text-to-speech")
async def text_to_speech(text: str = Form(...), voice: str = Form(DEFAULT_VOICE)):
    text = text.strip()
    if not text:
        return JSONResponse(status_code=422, content={"error": "Text must not be empty"})
    if len(text) > MAX_TTS_CHARS:
        return JSONResponse(status_code=413,
                            content={"error": f"Text exceeds {MAX_TTS_CHARS} characters"})

    tmp = os.path.join(tempfile.gettempdir(), f"tts_{uuid4().hex}.mp3")
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(tmp)
        with open(tmp, "rb") as fh:
            audio = fh.read()
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse(status_code=502, content={"error": f"TTS service unavailable: {e}"})
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
