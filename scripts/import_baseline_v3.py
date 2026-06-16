#!/usr/bin/env python3
"""
Import baseline_runs.jsonl into public.benchmark_runs as run_type='baseline'.

Usage:
    export DB_PASSWORD=<password>
    python3 scripts/import_baseline_v3.py

Expects a port-forward to be active on localhost:5432 → Cloud SQL proxy.
Each JSONL line becomes one row; generated_at becomes ran_at.
Label: "v3 Baseline iter {N}" per row.
"""

import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("pip install psycopg2-binary")

DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
if not DB_PASSWORD:
    sys.exit("Set DB_PASSWORD env var before running")

DB_PORT = int(os.environ.get("DB_PORT", "5432"))

MIGRATIONS_DIR = Path(__file__).parent.parent / "packages" / "seed-data" / "migrations"
JSONL = Path(__file__).parent / "baseline_runs.jsonl"
if not JSONL.exists():
    sys.exit(f"Not found: {JSONL}")

conn = psycopg2.connect(
    host="127.0.0.1",
    port=DB_PORT,
    dbname="bakeoff",
    user="bakeoff",
    password=DB_PASSWORD,
)
conn.autocommit = True
cur = conn.cursor()

for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
    print(f"Applying migration: {migration.name}")
    cur.execute(migration.read_text())

conn.autocommit = False
lines = JSONL.read_text().splitlines()
print(f"Importing {len(lines)} rows…")

inserted = 0
for raw in lines:
    raw = raw.strip()
    if not raw:
        continue
    row = json.loads(raw)
    iteration = row.get("iteration", "?")
    ran_at = row["generated_at"]
    label = f"v3 Baseline iter {iteration}"
    cur.execute(
        """
        INSERT INTO public.benchmark_runs (run_type, label, ran_at, results)
        VALUES ('baseline', %s, %s, %s)
        """,
        (label, ran_at, json.dumps(row)),
    )
    inserted += 1
    if inserted % 50 == 0:
        print(f"  {inserted}/{len(lines)}")

conn.commit()
cur.close()
conn.close()
print(f"Done — {inserted} rows inserted.")
