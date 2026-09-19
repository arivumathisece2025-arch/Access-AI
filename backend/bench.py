"""Per-query latency on THIS machine. Run after warmup."""
import sys
import time
from pathlib import Path

import httpx

BASE = "http://localhost:8000"


def bench_image(client: httpx.Client, path: Path, runs: int = 3) -> None:
    data = path.read_bytes()
    for i in range(runs):
        t0 = time.perf_counter()
        r = client.post(f"{BASE}/describe-image", files={"file": (path.name, data)}, timeout=300)
        dt = time.perf_counter() - t0
        r.raise_for_status()
        tag = "cached" if r.json().get("cached") else "fresh "
        print(f"image {tag} run {i + 1}: {dt:5.2f}s")


def bench_audio(client: httpx.Client, path: Path, runs: int = 2) -> None:
    data = path.read_bytes()
    for i in range(runs):
        t0 = time.perf_counter()
        r = client.post(f"{BASE}/speech-to-text", files={"file": (path.name, data)}, timeout=300)
        dt = time.perf_counter() - t0
        r.raise_for_status()
        print(f"audio run {i + 1}: {dt:5.2f}s -> {r.json()['transcription'][:60]!r}")


def bench_tts(client: httpx.Client, text: str, runs: int = 2) -> None:
    for i in range(runs):
        t0 = time.perf_counter()
        r = client.post(f"{BASE}/text-to-speech", data={"text": text}, timeout=60)
        dt = time.perf_counter() - t0
        r.raise_for_status()
        print(f"tts   run {i + 1}: {dt:5.2f}s ({len(r.content)} bytes)")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python bench.py <image_path> [audio_path]")
        sys.exit(1)
    with httpx.Client(timeout=300) as client:
        m = client.get(f"{BASE}/metrics").json()
        print(f"device={m['device']} whisper={m['whisper_model']} rss={m['rss_mb']}MB\n")
        bench_image(client, Path(sys.argv[1]))
        if len(sys.argv) >= 3:
            bench_audio(client, Path(sys.argv[2]))
        bench_tts(client, "The quick brown fox jumps over the lazy dog near the river bank.")


if __name__ == "__main__":
    main()
