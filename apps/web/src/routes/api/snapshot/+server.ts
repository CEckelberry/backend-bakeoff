import type { RequestHandler } from '@sveltejs/kit';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
const RESULTS_API_URL = process.env.RESULTS_API_URL || 'http://results-api:8080';
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export interface RuntimeSnapshot {
  p95: number;
  p50: number;
  p99: number;
  throughput: number;
  successRate: number;
  memoryMB: number | null;
  isLive: boolean;
}

// v3 baseline (2026-06-15, 500-iter, php-fpm+nginx, Symfony 8.0)
const BASELINE: Record<string, RuntimeSnapshot> = {
  rust:   { p95: 14.54,  p50: 6.83,  p99: 21.08,  throughput: 1723, successRate: 100.0,  memoryMB: null, isLive: false },
  go:     { p95: 15.27,  p50: 6.95,  p99: 22.31,  throughput: 1731, successRate: 99.99,  memoryMB: null, isLive: false },
  rails:  { p95: 20.90,  p50: 16.14, p99: 28.22,  throughput: 1177, successRate: 100.0,  memoryMB: null, isLive: false },
  node:   { p95: 17.94,  p50: 10.21, p99: 23.30,  throughput: 1682, successRate: 100.0,  memoryMB: null, isLive: false },
  python: { p95: 16.00,  p50: 10.34, p99: 22.57,  throughput: 1843, successRate: 99.99,  memoryMB: null, isLive: false },
  php:    { p95: 19.65,  p50: 14.16, p99: 24.26,  throughput: 1346, successRate: 100.0,  memoryMB: null, isLive: false },
};

async function promQuery(query: string): Promise<number | null> {
  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success' || !data.data.result.length) return null;
    const val = parseFloat(data.data.result[0].value[1]);
    return isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

async function fetchRuntimeSnapshot(runtime: string, port: number): Promise<RuntimeSnapshot> {
  const inst = `bo-${runtime}:${port}`;
  const base = BASELINE[runtime];

  // Only query memory — rate()-based metrics (latency, throughput, error rate) return
  // near-zero on an idle cluster and are only meaningful during active load tests.
  // Those values always come from the baseline benchmark run.
  const memRaw = await promQuery(`process_resident_memory_bytes{instance="${inst}"} / 1048576`);
  const memoryMB = memRaw !== null ? Math.round(memRaw) : null;

  return {
    ...base,
    memoryMB,
    isLive: memoryMB !== null,
  };
}

export const GET: RequestHandler = async () => {
  // Return cached snapshot if fresh
  try {
    const runsRes = await fetch(`${RESULTS_API_URL}/results`);
    if (runsRes.ok) {
      const { runs } = await runsRes.json() as {
        runs: Array<{ label: string | null; ran_at: string; results: Record<string, RuntimeSnapshot> }>;
      };
      const cached = runs.find((r) => r.label === 'auto-snapshot');
      if (cached && Date.now() - new Date(cached.ran_at).getTime() < SNAPSHOT_TTL_MS) {
        return new Response(JSON.stringify(cached.results), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch { /* fall through */ }

  // Query Prometheus for all runtimes in parallel
  const ports: Record<string, number> = {
    go: 8080, rust: 8080, rails: 8080, node: 8080, python: 8080, php: 8086,
  };
  const entries = await Promise.all(
    Object.entries(ports).map(async ([runtime, port]) => [
      runtime,
      await fetchRuntimeSnapshot(runtime, port),
    ] as const)
  );
  const results: Record<string, RuntimeSnapshot> = Object.fromEntries(entries);

  // Persist snapshot (fire-and-forget — never block the response)
  fetch(`${RESULTS_API_URL}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'auto-snapshot', results }),
  }).catch(() => {});

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
