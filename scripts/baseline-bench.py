#!/usr/bin/env python3
"""
baseline-bench.py — run 10 000 checkout trials against every backend
and write a baseline_results.json the frontend can use as seed data.

Usage:
    python3 scripts/baseline-bench.py [--trials N] [--concurrency C] [--out FILE]

Prerequisites:
    docker compose up -d (all backends healthy)
    pip install requests  (or: pip3 install requests)
"""

import argparse
import json
import math
import os
import random
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests is required: pip install requests")

REPO_ROOT = Path(__file__).parent.parent

BACKENDS = {
    "go":     "http://localhost:8081",
    "rust":   "http://localhost:8082",
    "rails":  "http://localhost:8083",
    "node":   "http://localhost:8084",
    "python": "http://localhost:8085",
    "php":    "http://localhost:8086",
}

# Products with enough stock to survive 10k runs without depleting
HIGH_STOCK_PRODUCT_IDS = [
    "cbfca731-9ff0-4cee-b98b-5a98483a6845",  # Bookshelf Speaker  stock=94
    "4897c680-c35b-434f-a94c-f3b2712bbabd",  # Over-Ear Headphones stock=204
    "b8b08287-21df-4678-9a73-fd0769dde5ee",  # Ethernet Cable      stock=179
    "fdf621b0-5b0e-454b-a98b-e4cc58bcc6da",  # Network Switch      stock=190
    "808f6e89-4af0-4459-a708-036e84af759d",  # USB Splitter        stock=168
    "805966bf-435d-4acc-93c3-896f84e22d18",  # Wall Adapter        stock=157
    "1afb5337-5ba6-40db-b617-103400bbf895",  # Car Charger         stock=146
    "67d809b8-b8dd-43be-b17b-4a065c369ed4",  # Portable Charger    stock=135
    "609cdba2-9201-45fd-a1af-31374b99dd91",  # Cable Clips         stock=124
    "dd3b626a-3b0a-4698-828e-600478f6e621",  # Mouse Bungee        stock=113
    "0746de93-bae5-41e4-9faf-254bb495682b",  # Keyboard Wrist Rest stock=102
    "d83e67c7-5251-497f-88e0-7672132e2e40",  # Monitor Arm         stock=91
    "82012d8a-693c-4cda-a06d-ffa9dbd01c12",  # Desk Chair          stock=80
    "10e960a2-f366-4ac6-b9db-8630a0e91ff6",  # Storage Box         stock=69
    "19adc02b-6f6c-4810-9df4-812841eaff90",  # Bookshelf           stock=58
]

SHIPPING = {"country": "US", "postal_code": "90210"}


def random_cart(size: int = 1) -> list[dict]:
    products = random.sample(HIGH_STOCK_PRODUCT_IDS, min(size, len(HIGH_STOCK_PRODUCT_IDS)))
    return [{"product_id": p, "quantity": 1} for p in products]


def do_checkout(session: requests.Session, base_url: str) -> tuple[float, int]:
    """Return (latency_ms, status_code). Never raises."""
    payload = {
        "customer_id": str(uuid.uuid4()),
        "shipping_address": SHIPPING,
        "cart": random_cart(random.randint(1, 3)),
    }
    t0 = time.perf_counter()
    try:
        resp = session.post(f"{base_url}/checkout", json=payload, timeout=10)
        status = resp.status_code
    except Exception:
        status = 0
    latency = (time.perf_counter() - t0) * 1000
    return latency, status


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = math.ceil(p / 100 * len(sorted_vals)) - 1
    return sorted_vals[max(0, idx)]


def wait_healthy(name: str, base_url: str, timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{base_url}/health", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def bench_backend(name: str, base_url: str, trials: int, concurrency: int) -> dict:
    print(f"  [{name}] checking health...", flush=True)
    if not wait_healthy(name, base_url):
        print(f"  [{name}] SKIP — not reachable at {base_url}", flush=True)
        return {"skipped": True, "reason": f"not reachable at {base_url}"}

    print(f"  [{name}] running {trials:,} trials (concurrency={concurrency})...", flush=True)
    latencies: list[float] = []
    errors = 0
    t_start = time.perf_counter()

    # One session per thread (keeps connection pools sane)
    def worker(_: int) -> tuple[float, int]:
        with requests.Session() as s:
            return do_checkout(s, base_url)

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(worker, i) for i in range(trials)]
        done = 0
        for fut in as_completed(futures):
            lat, status = fut.result()
            latencies.append(lat)
            if status not in (200, 201):
                errors += 1
            done += 1
            if done % 1000 == 0:
                print(f"  [{name}] {done:,}/{trials:,}", flush=True)

    elapsed = time.perf_counter() - t_start
    latencies.sort()

    result = {
        "skipped": False,
        "sample_count": trials,
        "errors": errors,
        "error_rate": round(errors / trials, 6),
        "throughput_rps": round(trials / elapsed, 2),
        "p50_ms": round(percentile(latencies, 50), 2),
        "p75_ms": round(percentile(latencies, 75), 2),
        "p95_ms": round(percentile(latencies, 95), 2),
        "p99_ms": round(percentile(latencies, 99), 2),
        "min_ms":  round(latencies[0], 2),
        "max_ms":  round(latencies[-1], 2),
        "mean_ms": round(sum(latencies) / len(latencies), 2),
        "duration_s": round(elapsed, 2),
    }
    print(
        f"  [{name}] done — p50={result['p50_ms']}ms  p95={result['p95_ms']}ms  "
        f"p99={result['p99_ms']}ms  rps={result['throughput_rps']}  "
        f"errors={errors}",
        flush=True,
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Bakeoff baseline benchmark")
    parser.add_argument("--trials",      type=int, default=10_000, help="requests per backend (default 10000)")
    parser.add_argument("--concurrency", type=int, default=20,     help="parallel workers (default 20)")
    parser.add_argument("--backends",    nargs="+", choices=list(BACKENDS), default=list(BACKENDS),
                        help="which backends to bench (default: all)")
    parser.add_argument("--out", default=str(REPO_ROOT / "scripts" / "baseline_results.json"),
                        help="output JSON path")
    args = parser.parse_args()

    print(f"\nBakeoff baseline benchmark")
    print(f"  trials={args.trials:,}  concurrency={args.concurrency}  backends={args.backends}")
    print(f"  output → {args.out}\n")

    results: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "trial_count":  args.trials,
        "concurrency":  args.concurrency,
        "backends":     {},
    }

    for name in args.backends:
        url = BACKENDS[name]
        results["backends"][name] = bench_backend(name, url, args.trials, args.concurrency)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults written to {out_path}")

    # Print summary table
    print("\n── Summary ─────────────────────────────────────────────────────────")
    print(f"{'Backend':<10} {'p50':>8} {'p95':>8} {'p99':>8} {'RPS':>10} {'Errors':>8}")
    print("─" * 60)
    for name, r in results["backends"].items():
        if r.get("skipped"):
            print(f"{name:<10} {'SKIPPED':>44}")
        else:
            print(
                f"{name:<10} {r['p50_ms']:>7}ms {r['p95_ms']:>7}ms {r['p99_ms']:>7}ms "
                f"{r['throughput_rps']:>10} {r['errors']:>8}"
            )
    print("─" * 60)


if __name__ == "__main__":
    main()
