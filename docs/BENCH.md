# Benchmarks — Access-AI

Engine: NVIDIA GeForce RTX 4060 (8 GB) · CUDA 12.4 · PyTorch 2.5.1+cu124 · Python 3.12
Stack: Florence-2-base fp16 · faster-whisper medium fp16 · RapidOCR (ONNX) · edge-tts

## Per-query latency (bench.py, docs/test.jpg)
| Query | Run | Latency |
|---|---|---|
| image (fresh) | 1 | 1.48 s |
| image (cached) | 2 | 0.00 s |
| image (cached) | 3 | 0.00 s |
| tts (30 KB mp3) | 1 | 1.12 s |
| tts (30 KB mp3) | 2 | 0.94 s |

## Memory
| Metric | Value |
|---|---|
| RSS after warmup | 1550.1 MB |

## Startup
| Metric | Value |
|---|---|
| warmup (models already in VRAM) | 1.8 s |

## Sustained load
soak.py output pending (Block 4)
# Benchmarks — Access-AI

Measured latency for every user-facing operation **on the demo machine**, recorded
after the model warmup completes. Judges see measured claims, not estimates.

> **Status: no bench run recorded yet.** Populate this file by running
> `backend/bench.py` (Block 1, step 7) against a live backend and pasting the
> output below. Do not invent numbers.

## Method

1. Start the backend and wait for the warmup line: `[startup] warmup done in Xs`.
   Cold numbers are meaningless — a user never queries a cold process.
2. Run, with a photo containing text and a 10–15s voice recording:

   ```bash
   cd backend
   python bench.py ..\docs\demo_image.jpg ..\docs\demo_audio.wav
   ```

3. Record the device, model sizes, and per-query latency. Image queries report
   `cached` vs `fresh` because repeat uploads are served from cache.

## Gates

If a gate fails, tune **before** building on top of it.

| Operation | Gate | Why |
|---|---|---|
| Image query, fresh, GPU | < 2.0s | Longer than this and the demo feels broken |
| Speech-to-text, 15s clip | < 3.0s | Users speak in short bursts; dead air kills trust |
| Text-to-speech | < 1.0s | Must start speaking almost immediately |

## Environment

| Field | Value |
|---|---|
| Device (`/metrics` → `device`) | — |
| Whisper model | — |
| Python / torch | — |
| GPU | — |
| OS | — |

## Results

| Operation | Run | Latency | Notes |
|---|---|---|---|
| image (fresh) | 1 | — | — |
| image (fresh) | 2 | — | — |
| image (fresh) | 3 | — | — |
| audio | 1 | — | — |
| audio | 2 | — | — |
| tts | 1 | — | — |
| tts | 2 | — | — |

## Raw output

```text
<paste full bench.py output here>
```

## Sustained load

`backend/soak.py` runs 200 queries and reports p50/p95 latency plus RSS drift.
Memory must stay flat — drift above 200 MB means unbounded growth and the app
will die partway through a long demo.

| Metric | Value |
|---|---|
| Queries | 200 |
| p50 | — |
| p95 | — |
| max | — |
| RSS drift | — |

```text
<paste soak.py summary here>
```