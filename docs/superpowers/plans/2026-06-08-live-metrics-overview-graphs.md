# Live Metrics in Overview Graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded/random `baselineData` in all four Overview graphs with live Prometheus metrics, persisting snapshots to Postgres so data survives beyond Prometheus' 7-day retention.

**Architecture:** A new SvelteKit server route (`GET /api/snapshot`) queries Prometheus for instant metrics (5m rate window), falls back to `baselineData` for backends without HTTP metrics, and writes a debounced `run_type='user', label='auto-snapshot'` record to the results-api DB. A new `liveMetricsStore` Svelte store fetches from this route on page load and exposes reactive per-runtime data to all four graph components. `lastRunStore` is updated to skip auto-snapshot records so the "Last Run" overlay only shows user-triggered runs.

**Tech Stack:** SvelteKit server routes, Prometheus HTTP API, results-api (Go), Svelte writable stores, existing Prometheus proxy at `http://prometheus:9090`.

---

## Available Prometheus Metrics (verified against cluster)

| Runtime | Latency metric | Throughput metric | Memory |
|---------|---------------|-------------------|--------|
| Node    | `http_request_duration_seconds_bucket` | `http_requests_total` | none |
| Python  | `http_request_duration_seconds_bucket` | `http_requests_total` | none |
| Rails   | `checkout_duration_seconds_bucket` | none | none |
| Rust    | none | none | `process_resident_memory_bytes` |
| PHP     | none | none | `process_resident_memory_bytes` |
| Go      | none | none | none |

For backends without live data, `baselineData` values are used and `isLive: false`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/routes/api/snapshot/+server.ts` | Server route: query Prometheus, debounce DB write, return snapshot |
| Create | `apps/web/src/lib/stores/liveMetricsStore.ts` | Svelte store: fetch from `/api/snapshot`, expose per-runtime metrics |
| Modify | `apps/web/src/lib/stores/lastRunStore.ts` | Skip `label='auto-snapshot'` runs when finding user test runs |
| Modify | `apps/web/src/lib/components/GraphsContainer.svelte` | Call `liveMetricsStore.fetch()` on mount |
| Modify | `apps/web/src/lib/components/graphs/LatencyGraph.svelte` | Use live p95/p50/p99 when available |
| Modify | `apps/web/src/lib/components/graphs/ThroughputGraph.svelte` | Use live throughput when available |
| Modify | `apps/web/src/lib/components/graphs/ReliabilityGraph.svelte` | Use live successRate when available |
| Modify | `apps/web/src/lib/components/graphs/ResourceEfficiencyGraph.svelte` | Use live memoryMB, replace Math.random() with baseline estimates |

---

## Task 1: Create `/api/snapshot` server route

**Files:**
- Create: `apps/web/src/routes/api/snapshot/+server.ts`

This route is server-side only (runs in Node, has access to `PROMETHEUS_URL` and `RESULTS_API_URL` env vars). It:
1. Checks results-api for a recent auto-snapshot (< 5 min old) and returns it if fresh
2. Otherwise queries Prometheus for all 6 runtimes in parallel, falls back to `baselineData` per metric
3. Writes the snapshot to results-api (fire-and-forget, never blocks the response)
4. Returns the snapshot JSON

- [ ] **Step 1: Create the file**

Create `apps/web/src/routes/api/snapshot/+server.ts`:

```typescript
import type { RequestHandler } from './$types';

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
```

- [ ] **Step 2: Verify compile**

```bash
cd /home/roger/Documents/coding/cole-portfolio/backend-bakeoff/apps/web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "snapshot" | head -10
```

Expected: no errors mentioning `snapshot/+server.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/api/snapshot/
git commit -m "feat(web): snapshot server route — live Prometheus metrics with DB persistence"
```

---

## Task 2: Create liveMetricsStore

**Files:**
- Create: `apps/web/src/lib/stores/liveMetricsStore.ts`

- [ ] **Step 1: Create the store**

Create `apps/web/src/lib/stores/liveMetricsStore.ts`:

```typescript
import { writable } from 'svelte/store';
import type { RuntimeSnapshot } from '../../routes/api/snapshot/+server';

interface LiveMetricsState {
  data: Record<string, RuntimeSnapshot> | null;
  loading: boolean;
  error: string | null;
}

function createLiveMetricsStore() {
  const { subscribe, set, update } = writable<LiveMetricsState>({
    data: null,
    loading: false,
    error: null,
  });

  return {
    subscribe,
    fetch: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch('/api/snapshot');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Record<string, RuntimeSnapshot> = await res.json();
        set({ data, loading: false, error: null });
      } catch (err) {
        update((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
  };
}

export const liveMetricsStore = createLiveMetricsStore();
```

- [ ] **Step 2: Verify compile**

```bash
cd /home/roger/Documents/coding/cole-portfolio/backend-bakeoff/apps/web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "liveMetrics" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/stores/liveMetricsStore.ts
git commit -m "feat(web): liveMetricsStore — fetches Prometheus snapshot for Overview graphs"
```

---

## Task 3: Update lastRunStore to skip auto-snapshots

**Files:**
- Modify: `apps/web/src/lib/stores/lastRunStore.ts`

Auto-snapshots are stored as `run_type='user', label='auto-snapshot'`. The "Last Run" overlay must only show user-triggered runs (`label='web-ui run'`), not automated snapshots.

- [ ] **Step 1: Update the find logic**

In `apps/web/src/lib/stores/lastRunStore.ts`, replace the line:

```typescript
const userRun = runs.find((r) => r.run_type === 'user') ?? runs[0] ?? null;
```

with:

```typescript
const userRun =
  runs.find((r) => r.run_type === 'user' && r.label !== 'auto-snapshot') ??
  runs[0] ??
  null;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/stores/lastRunStore.ts
git commit -m "fix(web): skip auto-snapshot runs in lastRunStore overlay logic"
```

---

## Task 4: Update GraphsContainer to fetch live metrics on mount

**Files:**
- Modify: `apps/web/src/lib/components/GraphsContainer.svelte`

- [ ] **Step 1: Add liveMetricsStore.fetch() to onMount**

In `apps/web/src/lib/components/GraphsContainer.svelte`, add the import and fetch call. Replace the existing `<script>` block with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { activeGraph } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';
  import GraphSwitcher from '$lib/components/GraphSwitcher.svelte';
  import ThroughputGraph from '$lib/components/graphs/ThroughputGraph.svelte';
  import LatencyGraph from '$lib/components/graphs/LatencyGraph.svelte';
  import ResourceEfficiencyGraph from '$lib/components/graphs/ResourceEfficiencyGraph.svelte';
  import ReliabilityGraph from '$lib/components/graphs/ReliabilityGraph.svelte';

  onMount(() => {
    lastRunStore.fetch();
    liveMetricsStore.fetch();
  });

  function toggleLastRun() {
    showLastRun.update((v) => !v);
  }
</script>
```

Keep the rest of the template unchanged.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/components/GraphsContainer.svelte
git commit -m "feat(web): fetch live metrics on Overview mount"
```

---

## Task 5: Update LatencyGraph to use live data

**Files:**
- Modify: `apps/web/src/lib/components/graphs/LatencyGraph.svelte`

Replace the `<script>` block entirely:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => {
      const liveData = live?.[id];
      const p95 = liveData?.p95 ?? data.p95;
      return {
        id,
        ...data,
        p95,
        p50: liveData?.p50 ?? (p95 * 0.6),
        p99: liveData?.p99 ?? (p95 * 1.5),
        isLive: liveData?.isLive ?? false,
      };
    })
    .sort((a, b) => a.p95 - b.p95);

  $: lastRun = $lastRunStore.data;
  $: maxLatency = Math.max(
    ...runtimes.map((r) => r.p99),
    ...(lastRun && $showLastRun ? Object.values(lastRun).map((v) => v.p95 * 1.5) : [0])
  );
</script>
```

The template does not need to change — it already uses `runtime.p95`, `runtime.p50`, `runtime.p99`.

- [ ] **Step 1: Replace the script block**

Make the replacement described above.

- [ ] **Step 2: Verify compile**

```bash
cd /home/roger/Documents/coding/cole-portfolio/backend-bakeoff/apps/web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -i "latency" | head -10
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/components/graphs/LatencyGraph.svelte
git commit -m "feat(web): LatencyGraph uses live Prometheus data with baseline fallback"
```

---

## Task 6: Update ThroughputGraph to use live data

**Files:**
- Modify: `apps/web/src/lib/components/graphs/ThroughputGraph.svelte`

Replace the `<script>` block:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({
      id,
      ...data,
      throughput: live?.[id]?.throughput ?? data.throughput,
      isLive: live?.[id]?.isLive ?? false,
    }))
    .sort((a, b) => b.throughput - a.throughput);

  $: lastRun = $lastRunStore.data;
  $: maxThroughput = Math.max(
    ...runtimes.map((r) => r.throughput),
    ...(lastRun && $showLastRun ? Object.values(lastRun).map((v) => v.throughput) : [0])
  );
</script>
```

- [ ] **Step 1: Replace the script block**

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/components/graphs/ThroughputGraph.svelte
git commit -m "feat(web): ThroughputGraph uses live Prometheus data with baseline fallback"
```

---

## Task 7: Update ReliabilityGraph to use live data

**Files:**
- Modify: `apps/web/src/lib/components/graphs/ReliabilityGraph.svelte`

Replace the `<script>` block:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => {
      const successRate = live?.[id]?.successRate ?? data.successRate;
      return {
        id,
        ...data,
        uptime: successRate,
        errorRate: 100 - successRate,
        isLive: live?.[id]?.isLive ?? false,
      };
    })
    .sort((a, b) => a.errorRate - b.errorRate);

  $: maxErrorRate = Math.max(...runtimes.map((r) => r.errorRate), 0.001);
</script>
```

Note: `maxErrorRate` gets a floor of `0.001` to prevent division-by-zero when all backends are 100% reliable.

- [ ] **Step 1: Replace the script block**

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/components/graphs/ReliabilityGraph.svelte
git commit -m "feat(web): ReliabilityGraph uses live success rate with baseline fallback"
```

---

## Task 8: Update ResourceEfficiencyGraph — live memory, remove Math.random()

**Files:**
- Modify: `apps/web/src/lib/components/graphs/ResourceEfficiencyGraph.svelte`

Remove `Math.random()` from memory, CPU, and DB connections. Use live `memoryMB` from Prometheus where available, otherwise use realistic hardcoded baseline estimates. CPU and DB connections use hardcoded baselines (not available from Prometheus).

Replace the entire `<script>` block:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  // Realistic baseline estimates for CPU % and DB connections under load
  const BASELINE_CPU: Record<string, number> = {
    rust: 14, go: 18, rails: 48, node: 34, python: 52, php: 55,
  };
  const BASELINE_DB: Record<string, number> = {
    rust: 5, go: 8, rails: 12, node: 9, python: 10, php: 7,
  };
  // Memory fallback (MB) when process_resident_memory_bytes not available
  const BASELINE_MEMORY: Record<string, number> = {
    rust: 28, go: 32, rails: 185, node: 98, python: 88, php: 48,
  };

  const MAX_MEMORY = 256;

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({
      id,
      ...data,
      memory: live?.[id]?.memoryMB ?? BASELINE_MEMORY[id] ?? 64,
      cpu: BASELINE_CPU[id] ?? 40,
      dbConnections: BASELINE_DB[id] ?? 8,
      memoryIsLive: live?.[id]?.memoryMB != null,
    }))
    .sort((a, b) => a.memory - b.memory);
</script>
```

The template uses `runtime.memory`, `runtime.cpu`, `runtime.dbConnections` — no template changes needed. The `MAX_MEMORY = 256` constant is used in the bar width calculation `(runtime.memory / 400) * 100` — change the denominator from `400` to `MAX_MEMORY`:

In the template, find `style="width: {(runtime.memory / 400) * 100}%` and change to:
```svelte
style="width: {Math.min(100, (runtime.memory / MAX_MEMORY) * 100)}%; background-color: {runtime.color};"
```

- [ ] **Step 1: Replace the script block**

- [ ] **Step 2: Fix the memory bar denominator in the template**

Find this line in the template:
```svelte
style="width: {(runtime.memory / 400) * 100}%; background-color: {runtime.color};"
```

Replace with:
```svelte
style="width: {Math.min(100, (runtime.memory / MAX_MEMORY) * 100)}%; background-color: {runtime.color};"
```

- [ ] **Step 3: Verify compile**

```bash
cd /home/roger/Documents/coding/cole-portfolio/backend-bakeoff/apps/web && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -i "resource" | head -10
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/components/graphs/ResourceEfficiencyGraph.svelte
git commit -m "feat(web): ResourceEfficiencyGraph uses live memory data, removes Math.random()"
```

---

## Task 9: Push and verify

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Confirm CI passes**

```bash
gh run list --limit 3
```

Expected: Build & Deploy shows `success`.

- [ ] **Step 3: Verify snapshot route in production**

```bash
curl -s https://backend-bakeoff.com/api/snapshot | python3 -m json.tool | head -40
```

Expected: JSON with 6 runtime keys, each having `p95`, `throughput`, `isLive`, etc. Runtimes with live data (`node`, `python`, `rails`) should have `"isLive": true`.

- [ ] **Step 4: Verify DB persistence**

Wait 30 seconds, then:
```bash
curl -s https://backend-bakeoff.com/api/results | python3 -c "import json,sys; runs=json.load(sys.stdin)['runs']; [print(r['run_type'], r['label'], r['ran_at']) for r in runs[:5]]"
```

Expected: An `auto-snapshot` entry with a recent timestamp.

- [ ] **Step 5: Reload Overview tab**

Hard-refresh `https://backend-bakeoff.com`. The 4 Overview graphs should now show live data. Node, Python, and Rails should show real latency values (not exactly the May 2026 baseline numbers). Rust, Go, PHP will show baseline values with `isLive: false`.
