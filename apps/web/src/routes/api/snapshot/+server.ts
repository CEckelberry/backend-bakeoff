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

const BASELINE: Record<string, RuntimeSnapshot> = {
  rust:   { p95: 16.01,  p50: 9.61,  p99: 24.02,  throughput: 1480, successRate: 100.0,  memoryMB: null, isLive: false },
  go:     { p95: 12.45,  p50: 7.47,  p99: 18.68,  throughput: 1210, successRate: 99.99,  memoryMB: null, isLive: false },
  rails:  { p95: 20.12,  p50: 12.07, p99: 30.18,  throughput:  820, successRate: 100.0,  memoryMB: null, isLive: false },
  node:   { p95: 17.16,  p50: 10.30, p99: 25.74,  throughput: 1090, successRate: 100.0,  memoryMB: null, isLive: false },
  python: { p95: 31.52,  p50: 18.91, p99: 47.28,  throughput:  690, successRate: 99.99,  memoryMB: null, isLive: false },
  php:    { p95: 144.86, p50: 86.92, p99: 217.29, throughput:  340, successRate: 100.0,  memoryMB: null, isLive: false },
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

  // Latency p95 — try HTTP histogram first, then checkout histogram
  let p95Raw = await promQuery(
    `histogram_quantile(0.95,sum by(le)(rate(http_request_duration_seconds_bucket{instance="${inst}"}[5m])))`
  );
  if (p95Raw === null) {
    p95Raw = await promQuery(
      `histogram_quantile(0.95,sum by(le)(rate(checkout_duration_seconds_bucket{instance="${inst}"}[5m])))`
    );
  }
  const p95 = p95Raw !== null ? p95Raw * 1000 : base.p95;
  const isLive = p95Raw !== null;

  // Throughput — try http_requests_total first, then checkout_requests_total
  let tpRaw = await promQuery(`sum(rate(http_requests_total{instance="${inst}"}[5m]))`);
  if (tpRaw === null) {
    tpRaw = await promQuery(`sum(rate(checkout_requests_total{instance="${inst}"}[5m]))`);
  }
  const throughput = tpRaw !== null ? Math.round(tpRaw) : base.throughput;

  // Success rate
  const errRaw = await promQuery(
    `sum(rate(http_requests_total{instance="${inst}",status=~"5.."}[5m])) / sum(rate(http_requests_total{instance="${inst}"}[5m]))`
  );
  const successRate = errRaw !== null ? (1 - errRaw) * 100 : base.successRate;

  // Memory MB
  const memRaw = await promQuery(`process_resident_memory_bytes{instance="${inst}"} / 1048576`);
  const memoryMB = memRaw !== null ? Math.round(memRaw) : null;

  return {
    p95,
    p50: p95 * 0.6,
    p99: p95 * 1.5,
    throughput,
    successRate: Math.min(100, Math.max(0, successRate)),
    memoryMB,
    isLive,
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
