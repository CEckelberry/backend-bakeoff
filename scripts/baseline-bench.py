#!/usr/bin/env python3

import argparse
import csv
import json
import math
import os
import random
import subprocess
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


HIGH_STOCK_PRODUCT_IDS = [
    "cbfca731-9ff0-4cee-b98b-5a98483a6845",
    "4897c680-c35b-434f-a94c-f3b2712bbabd",
    "b8b08287-21df-4678-9a73-fd0769dde5ee",
    "fdf621b0-5b0e-454b-a98b-e4cc58bcc6da",
    "808f6e89-4af0-4459-a708-036e84af759d",
    "805966bf-435d-4acc-93c3-896f84e22d18",
    "1afb5337-5ba6-40db-b617-103400bbf895",
    "67d809b8-b8dd-43be-b17b-4a065c369ed4",
    "609cdba2-9201-45fd-a1af-31374b99dd91",
    "dd3b626a-3b0a-4698-828e-600478f6e621",
    "0746de93-bae5-41e4-9faf-254bb495682b",
    "d83e67c7-5251-497f-88e0-7672132e2e40",
    "82012d8a-693c-4cda-a06d-ffa9dbd01c12",
    "10e960a2-f366-4ac6-b9db-8630a0e91ff6",
    "19adc02b-6f6c-4810-9df4-812841eaff90",
]

SHIPPING = {"country": "US", "postal_code": "90210"}

SCHEMA_NAMES = {
    "go":     "bakeoff_go",
    "rust":   "bakeoff_rust",
    "rails":  "bakeoff_rails",
    "node":   "bakeoff_node",
    "python": "bakeoff_python",
    "php":    "bakeoff_php",
}


def random_cart(size: int = 1) -> list[dict]:
    products = random.sample(HIGH_STOCK_PRODUCT_IDS, min(size, len(HIGH_STOCK_PRODUCT_IDS)))
    return [{"product_id": p, "quantity": 1} for p in products]


def build_checkout_payload(size: int) -> dict:
    return {
        "customer_id": str(uuid.uuid4()),
        "shipping_address": SHIPPING,
        "state": SHIPPING["country"],
        "items": random_cart(size),
    }


def do_post(session: requests.Session, url: str, payload: dict) -> tuple[float, int]:
    t0 = time.perf_counter()
    try:
        resp = session.post(url, json=payload, timeout=10)
        status = resp.status_code
    except Exception:
        status = 0
    latency = (time.perf_counter() - t0) * 1000
    return latency, status


def do_get(session: requests.Session, url: str) -> tuple[float, int]:
    t0 = time.perf_counter()
    try:
        resp = session.get(url, timeout=10)
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


def parse_mem_mib(mem_str: str) -> float:
    part = mem_str.split("/")[0].strip()
    if part.endswith("GiB"):
        return float(part[:-3]) * 1024
    if part.endswith("MiB"):
        return float(part[:-3])
    if part.endswith("kB") or part.endswith("KiB"):
        return float(part[:-2]) / 1024
    if part.endswith("MB"):
        return float(part[:-2])
    if part.endswith("GB"):
        return float(part[:-2]) * 1024
    return 0.0


PROMETHEUS_URL = "http://localhost:9092"


def query_prometheus_range(query: str, start: float, end: float, step: int = 5) -> list[float]:
    try:
        resp = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query_range",
            params={"query": query, "start": start, "end": end, "step": step},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") != "success":
            return []
        results = data["data"]["result"]
        if not results:
            return []
        return [float(v[1]) for series in results for v in series["values"] if v[1] != "NaN"]
    except Exception:
        return []


def get_saturation(instance: str, start: float, end: float) -> dict:
    cpu_vals = query_prometheus_range(
        f'rate(process_cpu_seconds_total{{instance="{instance}"}}[30s]) * 100',
        start, end,
    )
    mem_vals = query_prometheus_range(
        f'process_resident_memory_bytes{{instance="{instance}"}} / 1048576',
        start, end,
    )
    if cpu_vals and mem_vals:
        return {
            "cpu_mean_pct": round(sum(cpu_vals) / len(cpu_vals), 2),
            "cpu_max_pct": round(max(cpu_vals), 2),
            "mem_mean_mib": round(sum(mem_vals) / len(mem_vals), 2),
            "mem_max_mib": round(max(mem_vals), 2),
        }
    return {"cpu_mean_pct": None, "cpu_max_pct": None, "mem_mean_mib": None, "mem_max_mib": None}


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


def classify_error(status: int) -> tuple[int, int, int]:
    if 400 <= status < 500:
        return 1, 0, 0
    if 500 <= status < 600:
        return 0, 1, 0
    if status == 0:
        return 0, 0, 1
    return 0, 0, 0


def run_endpoint(label: str, name: str, worker_fn, trials: int, concurrency: int) -> dict:
    latencies: list[float] = []
    errors = 0
    errors_4xx = 0
    errors_5xx = 0
    errors_timeout = 0
    t_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(worker_fn, i) for i in range(trials)]
        done = 0
        for fut in as_completed(futures):
            lat, status = fut.result()
            latencies.append(lat)
            if status not in (200, 201):
                errors += 1
                e4, e5, et = classify_error(status)
                errors_4xx += e4
                errors_5xx += e5
                errors_timeout += et
            done += 1
            if done % 1000 == 0:
                print(f"  [{name}/{label}] {done:,}/{trials:,}", flush=True)

    elapsed = time.perf_counter() - t_start
    latencies.sort()

    return {
        "trials": trials,
        "errors": errors,
        "error_rate": round(errors / trials, 6),
        "errors_4xx": errors_4xx,
        "errors_5xx": errors_5xx,
        "errors_timeout": errors_timeout,
        "throughput_rps": round(trials / elapsed, 2),
        "p50_ms": round(percentile(latencies, 50), 2),
        "p75_ms": round(percentile(latencies, 75), 2),
        "p95_ms": round(percentile(latencies, 95), 2),
        "p99_ms": round(percentile(latencies, 99), 2),
        "min_ms": round(latencies[0], 2),
        "max_ms": round(latencies[-1], 2),
        "mean_ms": round(sum(latencies) / len(latencies), 2),
        "duration_s": round(elapsed, 2),
    }


def load_bench_tests(csv_path: str) -> list[dict]:
    tests = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tests.append({
                "name": row["name"].strip(),
                "method": row["method"].strip().upper(),
                "path": row["path"].strip(),
                "payload_type": row["payload_type"].strip(),
                "trials": int(row["trials"].strip()),
                "concurrency": int(row["concurrency"].strip()),
            })
    return tests


def get_sample_order_id(schema_name: str) -> str | None:
    try:
        out = subprocess.check_output(
            [
                "docker", "run", "--rm",
                "--network", "backend-bakeoff_backend-network",
                "postgres:18-alpine",
                "psql", "postgresql://postgres:password@db:5432/bakeoff",
                "-t", "-c", f"SELECT id FROM {schema_name}.orders LIMIT 1",
            ],
            stderr=subprocess.DEVNULL,
            timeout=15,
        ).decode().strip()
        if out:
            return out
        return None
    except Exception:
        return None


def docker_compose(args: list[str]) -> None:
    subprocess.run(
        ["docker", "compose"] + args,
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def reset_stock(name: str) -> None:
    schema = SCHEMA_NAMES[name]
    sql = (
        f"DELETE FROM {schema}.order_items; "
        f"DELETE FROM {schema}.orders; "
        f"UPDATE {schema}.products SET stock = 100000;"
    )
    subprocess.run(
        ["docker", "run", "--rm",
         "--network", "backend-bakeoff_backend-network",
         "postgres:18-alpine",
         "psql", "postgresql://postgres:password@db:5432/bakeoff",
         "-c", sql],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def resolve_path(path_template: str, order_id: str | None) -> str | None:
    if "{id}" not in path_template:
        return path_template
    if path_template.startswith("/products/"):
        return path_template.replace("{id}", random.choice(HIGH_STOCK_PRODUCT_IDS))
    if path_template.startswith("/orders/"):
        if order_id is None:
            return None
        return path_template.replace("{id}", order_id)
    return path_template.replace("{id}", str(uuid.uuid4()))


def make_worker(method: str, resolved_path: str, base_url: str, payload_type: str):
    url = f"{base_url}{resolved_path}"

    if method == "GET":
        def worker(_: int) -> tuple[float, int]:
            with requests.Session() as s:
                return do_get(s, url)
        return worker

    if payload_type == "checkout_1":
        cart_size = 1
    elif payload_type == "checkout_8":
        cart_size = 8
    else:
        cart_size = 1

    def worker(_: int) -> tuple[float, int]:
        with requests.Session() as s:
            return do_post(s, url, build_checkout_payload(cart_size))
    return worker


def bench_backend(
    name: str,
    base_url: str,
    bench_tests: list[dict],
) -> dict:
    service = f"bo-{name}"
    schema = SCHEMA_NAMES[name]

    print(f"  [{name}] resetting stock and orders...", flush=True)
    reset_stock(name)
    print(f"  [{name}] starting container...", flush=True)
    docker_compose(["up", "-d", "--no-deps", service])

    print(f"  [{name}] checking health...", flush=True)
    if not wait_healthy(name, base_url, timeout=60):
        docker_compose(["stop", service])
        print(f"  [{name}] SKIP — not reachable at {base_url}", flush=True)
        return {"skipped": True, "reason": f"not reachable at {base_url}"}

    prom_instance = f"bo-{name}:8080"
    test_start_time = time.time()

    order_id: str | None = None
    needs_order_id = any(
        t["path"].startswith("/orders/") and "{id}" in t["path"]
        for t in bench_tests
    )

    checkout_tests = [t for t in bench_tests if t["method"] == "POST" and t["path"] == "/checkout"]
    if needs_order_id and checkout_tests:
        print(f"  [{name}] running initial checkout to seed an order ID...", flush=True)
        seed_payload = build_checkout_payload(1)
        try:
            resp = requests.post(f"{base_url}/checkout", json=seed_payload, timeout=10)
            if resp.status_code in (200, 201):
                order_id = get_sample_order_id(schema)
        except Exception:
            pass
        if order_id is None:
            order_id = get_sample_order_id(schema)

    endpoint_results: dict[str, dict] = {}

    for test in bench_tests:
        test_name = test["name"]
        trials = test["trials"]
        concurrency = test["concurrency"]
        method = test["method"]
        path_template = test["path"]
        payload_type = test["payload_type"]

        resolved = resolve_path(path_template, order_id)
        if resolved is None:
            print(f"  [{name}] skipping {test_name} — no order ID available", flush=True)
            endpoint_results[test_name] = {"skipped": True, "reason": "no order ID available"}
            continue

        print(f"  [{name}] {test_name}: {trials:,} trials (concurrency={concurrency})", flush=True)
        worker = make_worker(method, resolved, base_url, payload_type)
        endpoint_results[test_name] = run_endpoint(test_name, name, worker, trials, concurrency)

        if needs_order_id and order_id is None and method == "POST" and path_template == "/checkout":
            order_id = get_sample_order_id(schema)

    test_end_time = time.time()
    saturation = get_saturation(prom_instance, test_start_time, test_end_time)

    print(f"  [{name}] stopping container...", flush=True)
    docker_compose(["stop", f"bo-{name}"])

    total_errors = sum(
        r.get("errors", 0)
        for r in endpoint_results.values()
        if not r.get("skipped")
    )
    first_checkout = next(
        (endpoint_results[t["name"]] for t in bench_tests
         if t["method"] == "POST" and not endpoint_results.get(t["name"], {}).get("skipped")),
        None,
    )
    if first_checkout:
        print(
            f"  [{name}] done — {list(bench_tests)[0]['name'] if bench_tests else 'n/a'} "
            f"p50={first_checkout['p50_ms']}ms "
            f"p95={first_checkout['p95_ms']}ms rps={first_checkout['throughput_rps']} "
            f"total_errors={total_errors}",
            flush=True,
        )
    else:
        print(f"  [{name}] done — total_errors={total_errors}", flush=True)

    return {
        "skipped": False,
        "saturation": saturation,
        "endpoints": endpoint_results,
    }


def main() -> None:
    default_tests_csv = str(REPO_ROOT / "scripts" / "bench_tests.csv")

    parser = argparse.ArgumentParser(description="Bakeoff baseline benchmark")
    parser.add_argument("--tests",       default=default_tests_csv,
                        help=f"path to bench_tests CSV (default: {default_tests_csv})")
    parser.add_argument("--backends",    nargs="+", choices=list(BACKENDS), default=list(BACKENDS),
                        help="which backends to bench (default: all)")
    parser.add_argument("--out",         default=str(REPO_ROOT / "scripts" / "baseline_results.json"),
                        help="output JSON path")
    args = parser.parse_args()

    bench_tests = load_bench_tests(args.tests)

    print(f"\nBakeoff baseline benchmark")
    print(f"  tests={args.tests}  backends={args.backends}")
    print(f"  output → {args.out}\n")
    print(f"  Loaded {len(bench_tests)} test(s) from CSV:")
    for t in bench_tests:
        print(f"    {t['name']:25s} {t['method']:4s} {t['path']:30s} trials={t['trials']:,} concurrency={t['concurrency']}")
    print()

    print("Stopping all backends for isolated testing...", flush=True)
    all_services = [f"bo-{n}" for n in BACKENDS]
    docker_compose(["stop"] + all_services)
    print("All backends stopped. Testing one at a time.\n", flush=True)

    results: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tests_csv": args.tests,
        "backends": {},
    }

    for name in args.backends:
        url = BACKENDS[name]
        results["backends"][name] = bench_backend(name, url, bench_tests)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults written to {out_path}")

    test_names = [t["name"] for t in bench_tests]
    col_w = max(len(n) for n in test_names) if test_names else 20

    print("\n── Summary ──────────────────────────────────────────────────────────────────────────────────")
    header = f"{'Backend':<10} {'Test':<{col_w}} {'p50':>8} {'p95':>8} {'RPS':>9} {'Errors':>8}"
    print(header)
    print("─" * len(header))

    for name, r in results["backends"].items():
        if r.get("skipped"):
            print(f"{name:<10} {'SKIPPED'}")
            continue
        endpoints = r.get("endpoints", {})
        for test_name in test_names:
            ep = endpoints.get(test_name)
            if ep is None:
                continue
            if ep.get("skipped"):
                print(f"{name:<10} {test_name:<{col_w}} {'SKIPPED':>8}")
                continue
            print(
                f"{name:<10} {test_name:<{col_w}} "
                f"{ep['p50_ms']:>7}ms {ep['p95_ms']:>7}ms "
                f"{ep['throughput_rps']:>9} {ep['errors']:>8}"
            )

    print("─" * len(header))


if __name__ == "__main__":
    main()
