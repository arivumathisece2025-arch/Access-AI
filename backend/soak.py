"""Sustained-use proof: 200 queries, latency percentiles + memory drift."""
import statistics
import sys
import time
from pathlib import Path

import httpx

BASE = "http://localhost:8000"


def soak(image_path: Path, iterations: int = 200) -> None:
    data = image_path.read_bytes()
    latencies: list[float] = []
    rss_samples: list[float] = []

    with httpx.Client(timeout=300) as client:
        for i in range(iterations):
            t0 = time.perf_counter()
            r = client.post(f"{BASE}/describe-image", files={"file": (image_path.name, data)})
            dt = time.perf_counter() - t0
            r.raise_for_status()
            latencies.append(dt)
            if i % 20 == 0:
                m = client.get(f"{BASE}/metrics").json()
                rss_samples.append(m["rss_mb"])
                print(f"iter {i:3d} | lat {dt:5.2f}s | rss {m['rss_mb']:7.1f} MB | served {m['requests_served']}")

    latencies.sort()
    p50 = latencies[len(latencies) // 2]
    p95 = latencies[int(len(latencies) * 0.95)]
    drift = rss_samples[-1] - rss_samples[0] if rss_samples else 0.0

    print("\n--- soak summary ---")
    print(f"queries:   {iterations}")
    print(f"latency:   p50={p50:.2f}s  p95={p95:.2f}s  max={latencies[-1]:.2f}s")
    print(f"rss drift: {drift:+.1f} MB")
    print("WARNING: memory drift — hunt unbounded growth" if drift > 200
          else "OK: memory flat — safe for sustained use")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python soak.py <image_path> [iterations]")
        sys.exit(1)
    soak(Path(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 200)
