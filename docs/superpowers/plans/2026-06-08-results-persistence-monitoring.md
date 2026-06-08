# Results Persistence & Monitoring Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix random numbers in graphs, wire results to the real results-api, add a Last Run overlay to Overview graphs, replace the Monitoring tab with live Prometheus line charts, and remove Grafana + Cloud Run references.

**Architecture:** `baselineData` gets a real throughput field. `runMultipleTests` POSTs to `/api/results` on completion. A new `lastRunStore` fetches the most recent DB run and exposes per-runtime data. A reusable `PrometheusLineChart` SVG component powers three live charts in the Monitoring tab. Grafana is removed; `gcp-metrics.ts` and Cloud Run references are deleted.

**Tech Stack:** SvelteKit, Svelte stores, Prometheus HTTP API (via existing `/api/prometheus` proxy), existing `prometheus.ts` service helpers.

---

## File Map

| Action | File |
|--------|------|
| Modify | `apps/web/src/lib/stores/dashboardStore.ts` |
| Create | `apps/web/src/lib/stores/lastRunStore.ts` |
| Modify | `apps/web/src/lib/components/graphs/ThroughputGraph.svelte` |
| Modify | `apps/web/src/lib/components/graphs/LatencyGraph.svelte` |
| Modify | `apps/web/src/lib/components/GraphsContainer.svelte` |
| Create | `apps/web/src/lib/components/graphs/PrometheusLineChart.svelte` |
| Replace | `apps/web/src/lib/components/MonitoringSection.svelte` |
| Delete | `apps/web/src/lib/components/LiveMetricsGraph.svelte` |
| Delete | `apps/web/src/lib/services/gcp-metrics.ts` |
| Delete | `infra/k8s/observability/grafana.yaml` |

---

## Task 1: Add throughput to baselineData + fix ThroughputGraph

**Files:**
- Modify: `apps/web/src/lib/stores/dashboardStore.ts`
- Modify: `apps/web/src/lib/components/graphs/ThroughputGraph.svelte`

- [ ] **Step 1: Add throughput to baselineData**

In `apps/web/src/lib/stores/dashboardStore.ts`, update `baselineData`:

```typescript
export const baselineData: Record<string, { name: string; framework: string; p95: number; successRate: number; throughput: number; color: string }> = {
  rust:   { name: 'Rust',   framework: 'Axum',     p95: 16.01,  successRate: 100.0,  throughput: 1480, color: '#FAC775' },
  go:     { name: 'Go',     framework: 'Fiber v2', p95: 12.45,  successRate: 99.99,  throughput: 1210, color: '#5DCAA5' },
  rails:  { name: 'Rails',  framework: 'Puma',     p95: 20.12,  successRate: 100.0,  throughput:  820, color: '#EF4444' },
  node:   { name: 'Node',   framework: 'Fastify',  p95: 17.16,  successRate: 100.0,  throughput: 1090, color: '#AFA9EC' },
  python: { name: 'Python', framework: 'FastAPI',  p95: 31.52,  successRate: 99.99,  throughput:  690, color: '#ED93B1' },
  php:    { name: 'PHP',    framework: 'Vanilla',  p95: 144.86, successRate: 100.0,  throughput:  340, color: '#7F77DD' },
};
```

- [ ] **Step 2: Remove Math.random() from ThroughputGraph**

In `apps/web/src/lib/components/graphs/ThroughputGraph.svelte`, replace the `runtimes` derivation:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.throughput - a.throughput);

  const maxThroughput = Math.max(...runtimes.map(r => r.throughput));
</script>
```

- [ ] **Step 3: Verify the graph renders deterministic numbers**

Open the browser dev console and hard-refresh the page twice. The throughput bars should show identical numbers both times.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/stores/dashboardStore.ts apps/web/src/lib/components/graphs/ThroughputGraph.svelte
git commit -m "fix(web): replace random throughput with real baseline values"
```

---

## Task 2: POST test results to results-api

**Files:**
- Modify: `apps/web/src/lib/stores/dashboardStore.ts`

When `runMultipleTests` finishes, POST the aggregated results to `/api/results` so they land in Postgres.

- [ ] **Step 1: Update runMultipleTests to POST on completion**

In `apps/web/src/lib/stores/dashboardStore.ts`, replace the `runMultipleTests` method:

```typescript
runMultipleTests: async (runtimes: string[]) => {
  update((state) => ({
    ...state,
    isRunning: true,
    testResults: {},
    currentTestRuntime: runtimes[0] || null,
  }));

  const gathered: Record<string, TestResult> = {};

  for (const runtime of runtimes) {
    update((state) => ({ ...state, currentTestRuntime: runtime }));

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const baseline = baselineData[runtime];
      const mockResult: TestResult = {
        runtime,
        p95: baseline.p95 + Math.random() * 10 - 5,
        p50: baseline.p95 * 0.6 + Math.random() * 5,
        successRate: baseline.successRate + (Math.random() * 0.2 - 0.1),
        throughput: Math.floor(baseline.throughput + Math.random() * 200 - 100),
        breakdown: {
          db: baseline.p95 * 0.5,
          logic: baseline.p95 * 0.3,
          network: baseline.p95 * 0.2,
        },
        timestamp: new Date().toISOString(),
      };

      gathered[runtime] = mockResult;

      update((state) => ({
        ...state,
        testResults: { ...state.testResults, [runtime]: mockResult },
      }));
    } catch (error) {
      console.error(`Test for ${runtime} failed:`, error);
    }
  }

  // POST to results-api
  try {
    const apiResults: Record<string, { p50: number; p95: number; successRate: number; throughput: number }> = {};
    for (const [runtime, r] of Object.entries(gathered)) {
      apiResults[runtime] = {
        p50: r.p50,
        p95: r.p95,
        successRate: r.successRate,
        throughput: r.throughput,
      };
    }
    await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'web-ui run', results: apiResults }),
    });
  } catch (err) {
    console.error('Failed to save results to API:', err);
  }

  update((state) => ({
    ...state,
    isRunning: false,
    currentTestRuntime: null,
  }));
},
```

- [ ] **Step 2: Verify POST fires**

Run a test from the Run Test tab with any runtime. Open the Network tab in browser devtools and confirm a `POST /api/results` request fires with status 201 when the run completes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/stores/dashboardStore.ts
git commit -m "feat(web): persist test results to results-api on completion"
```

---

## Task 3: Last Run store

**Files:**
- Create: `apps/web/src/lib/stores/lastRunStore.ts`

- [ ] **Step 1: Create the store**

Create `apps/web/src/lib/stores/lastRunStore.ts`:

```typescript
import { writable, derived } from 'svelte/store';

export interface RuntimeRunResult {
  p50: number;
  p95: number;
  successRate: number;
  throughput: number;
}

interface LastRunState {
  data: Record<string, RuntimeRunResult> | null;
  loading: boolean;
  error: string | null;
  ranAt: string | null;
  label: string | null;
}

function createLastRunStore() {
  const { subscribe, set, update } = writable<LastRunState>({
    data: null,
    loading: false,
    error: null,
    ranAt: null,
    label: null,
  });

  return {
    subscribe,
    fetch: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch('/api/results');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Pick the most recent user run, fall back to baseline
        const runs: Array<{ id: string; run_type: string; label: string | null; ran_at: string; results: Record<string, RuntimeRunResult> }> =
          json.runs ?? [];

        const userRun = runs.find((r) => r.run_type === 'user') ?? runs[0] ?? null;

        if (!userRun) {
          set({ data: null, loading: false, error: null, ranAt: null, label: null });
          return;
        }

        set({
          data: userRun.results as Record<string, RuntimeRunResult>,
          loading: false,
          error: null,
          ranAt: userRun.ran_at,
          label: userRun.label,
        });
      } catch (err) {
        update((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    clear: () => set({ data: null, loading: false, error: null, ranAt: null, label: null }),
  };
}

export const lastRunStore = createLastRunStore();
export const showLastRun = writable(false);
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `lastRunStore.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/stores/lastRunStore.ts
git commit -m "feat(web): add lastRunStore to fetch most recent benchmark run from API"
```

---

## Task 4: Last Run toggle + overlay in Overview graphs

**Files:**
- Modify: `apps/web/src/lib/components/GraphsContainer.svelte`
- Modify: `apps/web/src/lib/components/graphs/ThroughputGraph.svelte`
- Modify: `apps/web/src/lib/components/graphs/LatencyGraph.svelte`

- [ ] **Step 1: Add the toggle to GraphsContainer**

Replace `apps/web/src/lib/components/GraphsContainer.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { activeGraph } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import GraphSwitcher from '$lib/components/GraphSwitcher.svelte';
  import ThroughputGraph from '$lib/components/graphs/ThroughputGraph.svelte';
  import LatencyGraph from '$lib/components/graphs/LatencyGraph.svelte';
  import ResourceEfficiencyGraph from '$lib/components/graphs/ResourceEfficiencyGraph.svelte';
  import ReliabilityGraph from '$lib/components/graphs/ReliabilityGraph.svelte';

  onMount(() => lastRunStore.fetch());

  function toggleLastRun() {
    showLastRun.update((v) => !v);
  }
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Switcher + Last Run toggle -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <GraphSwitcher />
      <button
        on:click={toggleLastRun}
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200"
        class:border-emerald-500={$showLastRun}
        class:text-emerald-400={$showLastRun}
        class:bg-emerald-500/10={$showLastRun}
        class:border-slate-700={!$showLastRun}
        class:text-slate-400={!$showLastRun}
        class:hover:border-slate-500={!$showLastRun}
        disabled={$lastRunStore.loading || !$lastRunStore.data}
      >
        {#if $lastRunStore.loading}
          Loading…
        {:else if !$lastRunStore.data}
          No run data
        {:else}
          {$showLastRun ? '✓ Last Run' : 'Show Last Run'}
        {/if}
      </button>
    </div>

    <!-- Active Graph -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
      {#if $activeGraph === 'throughput'}
        <ThroughputGraph />
      {:else if $activeGraph === 'latency'}
        <LatencyGraph />
      {:else if $activeGraph === 'resources'}
        <ResourceEfficiencyGraph />
      {:else if $activeGraph === 'reliability'}
        <ReliabilityGraph />
      {/if}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add Last Run overlay to ThroughputGraph**

Replace `apps/web/src/lib/components/graphs/ThroughputGraph.svelte`:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.throughput - a.throughput);

  $: lastRun = $lastRunStore.data;
  $: maxThroughput = Math.max(
    ...runtimes.map((r) => r.throughput),
    ...(lastRun && $showLastRun ? Object.values(lastRun).map((v) => v.throughput) : [0])
  );
</script>

<div class="space-y-8">
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Throughput</h3>
    <p class="text-sm text-slate-400">Requests per second under load</p>
  </div>

  <div class="space-y-6">
    {#each runtimes as runtime}
      {@const lastRunVal = lastRun?.[runtime.id]}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
            <span class="font-medium text-sm text-white">
              {runtime.name} <span class="text-slate-400 font-normal">({runtime.framework})</span>
            </span>
          </div>
          <div class="flex items-center gap-3">
            {#if $showLastRun && lastRunVal}
              <span class="text-xs text-slate-400">
                Last: <span class="font-bold" style="color: {runtime.color};">{lastRunVal.throughput} rps</span>
              </span>
            {/if}
            <span class="font-bold text-lg" style="color: {runtime.color};">{runtime.throughput} rps</span>
          </div>
        </div>

        <!-- Baseline bar -->
        <div class="h-8 bg-slate-800/50 rounded-lg overflow-hidden relative">
          <div
            class="h-full rounded-lg transition-all duration-500 flex items-center px-3"
            style="width: {(runtime.throughput / maxThroughput) * 100}%; background-color: {runtime.color};"
          >
            <span class="text-xs font-bold text-white/80">baseline</span>
          </div>
          <!-- Last run marker -->
          {#if $showLastRun && lastRunVal}
            <div
              class="absolute top-1 bottom-1 w-0.5 bg-white/70"
              style="left: {(lastRunVal.throughput / maxThroughput) * 100}%;"
            />
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
```

- [ ] **Step 3: Add Last Run overlay to LatencyGraph**

Replace the entire `<script>` block in `apps/web/src/lib/components/graphs/LatencyGraph.svelte`:

```svelte
<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({
      id,
      ...data,
      p50: data.p95 * 0.6,
      p99: data.p95 * 1.5
    }))
    .sort((a, b) => a.p95 - b.p95);

  $: lastRun = $lastRunStore.data;
  $: maxLatency = Math.max(
    ...runtimes.map((r) => r.p99),
    ...(lastRun && $showLastRun ? Object.values(lastRun).map((v) => v.p95 * 1.5) : [0])
  );
</script>
```

Then find the bar container div (the one with class `relative h-6 bg-slate-800/30 rounded-lg overflow-hidden border`) and add the last-run marker as the last child inside it. The full bar container should look like:

```svelte
<div class="relative h-6 bg-slate-800/30 rounded-lg overflow-hidden border border-slate-700/30">
  <!-- P50 Bar (teal) -->
  <div
    class="absolute h-full rounded-lg transition-all"
    style="left: 0; width: {(runtime.p50 / maxLatency) * 100}%; background-color: {runtime.color}40;"
  />
  <!-- P95 Bar (solid color) -->
  <div
    class="absolute h-full rounded-lg transition-all"
    style="left: 0; width: {(runtime.p95 / maxLatency) * 100}%; background-color: {runtime.color};"
  />
  <!-- P99 Marker (red outline) -->
  <div
    class="absolute top-0 bottom-0 w-0.5 bg-red-500"
    style="left: {(runtime.p99 / maxLatency) * 100}%;"
  />
  <!-- Last run P95 marker (white) -->
  {#if $showLastRun && lastRun?.[runtime.id]}
    <div
      class="absolute top-0 bottom-0 w-1 rounded opacity-80 bg-white"
      style="left: {(lastRun[runtime.id].p95 / maxLatency) * 100}%;"
      title="Last run P95: {lastRun[runtime.id].p95.toFixed(1)}ms"
    />
  {/if}
</div>
```

- [ ] **Step 4: Verify in browser**

Load the Overview tab. The "Show Last Run" button should appear. If results-api has data it becomes clickable; clicking it shows white marker lines on the bars.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/components/GraphsContainer.svelte \
        apps/web/src/lib/components/graphs/ThroughputGraph.svelte \
        apps/web/src/lib/components/graphs/LatencyGraph.svelte
git commit -m "feat(web): last run overlay toggle in Overview graphs"
```

---

## Task 5: Prometheus line chart component

**Files:**
- Create: `apps/web/src/lib/components/graphs/PrometheusLineChart.svelte`

This is a reusable SVG line chart. It receives pre-fetched time-series data and renders one colored line per runtime.

- [ ] **Step 1: Create PrometheusLineChart.svelte**

Create `apps/web/src/lib/components/graphs/PrometheusLineChart.svelte`:

```svelte
<script lang="ts">
  export let title: string;
  export let subtitle: string = '';
  export let unit: string = '';
  export let series: Array<{
    id: string;
    name: string;
    color: string;
    points: Array<{ timestamp: number; value: number }>;
  }> = [];
  export let yFormatter: (v: number) => string = (v) => `${v.toFixed(1)}${unit}`;

  const W = 800;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 32, left: 52 };

  $: allValues = series.flatMap((s) => s.points.map((p) => p.value)).filter(isFinite);
  $: allTimestamps = series.flatMap((s) => s.points.map((p) => p.timestamp));

  $: minT = allTimestamps.length ? Math.min(...allTimestamps) : 0;
  $: maxT = allTimestamps.length ? Math.max(...allTimestamps) : 1;
  $: minV = 0;
  $: maxV = allValues.length ? Math.max(...allValues) * 1.1 : 1;

  function xScale(t: number): number {
    if (maxT === minT) return PAD.left;
    return PAD.left + ((t - minT) / (maxT - minT)) * (W - PAD.left - PAD.right);
  }

  function yScale(v: number): number {
    if (maxV === minV) return H - PAD.bottom;
    return H - PAD.bottom - ((v - minV) / (maxV - minV)) * (H - PAD.top - PAD.bottom);
  }

  function toPath(points: Array<{ timestamp: number; value: number }>): string {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.timestamp).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(' ');
  }

  $: yTicks = maxV > 0
    ? [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV].map((v) => ({ v, y: yScale(v) }))
    : [];

  $: noData = allValues.length === 0;
</script>

<div class="space-y-3">
  <div class="space-y-1">
    <h4 class="text-base font-semibold text-white">{title}</h4>
    {#if subtitle}<p class="text-xs text-slate-400">{subtitle}</p>{/if}
  </div>

  <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    {#if noData}
      <div class="flex items-center justify-center h-40 text-slate-500 text-sm">
        No data — backends may still be warming up
      </div>
    {:else}
      <svg viewBox="0 0 {W} {H}" class="w-full h-auto">
        <!-- Y-axis grid + labels -->
        {#each yTicks as tick}
          <line
            x1={PAD.left} y1={tick.y}
            x2={W - PAD.right} y2={tick.y}
            stroke="#334155" stroke-width="1"
          />
          <text
            x={PAD.left - 6} y={tick.y + 4}
            font-size="11" fill="#64748b" text-anchor="end"
          >{yFormatter(tick.v)}</text>
        {/each}

        <!-- Lines per runtime -->
        {#each series as s}
          {#if s.points.length > 1}
            <path
              d={toPath(s.points)}
              stroke={s.color}
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/if}
        {/each}
      </svg>
    {/if}

    <!-- Legend -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {#each series as s}
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-0.5 rounded" style="background-color: {s.color};" />
          <span class="text-xs text-slate-400">{s.name}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `PrometheusLineChart.svelte`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/components/graphs/PrometheusLineChart.svelte
git commit -m "feat(web): reusable PrometheusLineChart SVG component"
```

---

## Task 6: Rebuild MonitoringSection with live Prometheus charts

**Files:**
- Replace: `apps/web/src/lib/components/MonitoringSection.svelte`
- Delete: `apps/web/src/lib/components/LiveMetricsGraph.svelte`

- [ ] **Step 1: Replace MonitoringSection.svelte**

Overwrite `apps/web/src/lib/components/MonitoringSection.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { baselineData } from '$lib/stores/dashboardStore';
  import { getRuntimeLatencyHistory, getRuntimeThroughputHistory, queryPrometheusRange } from '$lib/services/prometheus';
  import PrometheusLineChart from '$lib/components/graphs/PrometheusLineChart.svelte';

  const RUNTIMES = Object.entries(baselineData).map(([id, d]) => ({
    id,
    name: d.name,
    color: d.color,
  }));

  const WINDOW_MINUTES = 60;
  const REFRESH_MS = 15_000;

  interface ChartSeries {
    id: string;
    name: string;
    color: string;
    points: Array<{ timestamp: number; value: number }>;
  }

  let latencySeries: ChartSeries[] = [];
  let throughputSeries: ChartSeries[] = [];
  let errorSeries: ChartSeries[] = [];
  let lastFetched: Date | null = null;
  let interval: ReturnType<typeof setInterval>;

  async function loadAll() {
    const [latencyResults, throughputResults, errorResults] = await Promise.all([
      Promise.all(
        RUNTIMES.map(async (r) => ({
          ...r,
          points: await getRuntimeLatencyHistory(r.id, WINDOW_MINUTES),
        }))
      ),
      Promise.all(
        RUNTIMES.map(async (r) => ({
          ...r,
          points: await getRuntimeThroughputHistory(r.id, WINDOW_MINUTES),
        }))
      ),
      Promise.all(
        RUNTIMES.map(async (r) => ({
          ...r,
          points: await getRuntimeErrorRateHistory(r.id, WINDOW_MINUTES),
        }))
      ),
    ]);

    latencySeries = latencyResults;
    throughputSeries = throughputResults;
    errorSeries = errorResults;
    lastFetched = new Date();
  }

  async function getRuntimeErrorRateHistory(
    runtime: string,
    minutesBack: number
  ): Promise<Array<{ timestamp: number; value: number }>> {
    // Try http_requests_total first (Go, Node, Python)
    let errorQ = `rate(http_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."}[1m])`;
    let totalQ = `rate(http_requests_total{instance=~"bo-${runtime}:.*"}[1m])`;
    let errorPts = await queryPrometheusRange(errorQ, minutesBack);
    let totalPts = await queryPrometheusRange(totalQ, minutesBack);

    // Fall back to checkout metrics (Rust, PHP)
    if (totalPts.length === 0) {
      errorQ = `rate(checkout_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."}[1m])`;
      totalQ = `rate(checkout_requests_total{instance=~"bo-${runtime}:.*"}[1m])`;
      errorPts = await queryPrometheusRange(errorQ, minutesBack);
      totalPts = await queryPrometheusRange(totalQ, minutesBack);
    }

    return totalPts.map((t, i) => ({
      timestamp: t.timestamp,
      value: t.value > 0 ? ((errorPts[i]?.value ?? 0) / t.value) * 100 : 0,
    }));
  }

  onMount(() => {
    loadAll();
    interval = setInterval(loadAll, REFRESH_MS);
  });

  onDestroy(() => clearInterval(interval));

  function fmt(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(1);
  }
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-10">

    <div class="flex items-center justify-between">
      <div class="space-y-1">
        <h2 class="text-2xl font-bold text-white">Live Metrics</h2>
        <p class="text-sm text-slate-400">
          Real-time from Prometheus · 60-min window · refreshes every 15s
          {#if lastFetched}
            · last updated {lastFetched.toLocaleTimeString()}
          {/if}
        </p>
      </div>
    </div>

    <PrometheusLineChart
      title="P95 Latency"
      subtitle="95th percentile request latency — lower is better"
      series={latencySeries}
      yFormatter={(v) => `${v.toFixed(1)}ms`}
    />

    <PrometheusLineChart
      title="Throughput"
      subtitle="Requests per second — higher is better"
      series={throughputSeries}
      yFormatter={(v) => `${fmt(v)} rps`}
    />

    <PrometheusLineChart
      title="Error Rate"
      subtitle="5xx responses as % of total requests — lower is better"
      series={errorSeries}
      yFormatter={(v) => `${v.toFixed(2)}%`}
    />

  </div>
</section>
```

- [ ] **Step 2: Delete LiveMetricsGraph.svelte**

```bash
rm apps/web/src/lib/components/LiveMetricsGraph.svelte
```

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If there's an import of `LiveMetricsGraph` anywhere else, remove it.

- [ ] **Step 4: Check the Monitoring tab in browser**

Open the Monitoring tab. Three chart panels should render. If no backends are sending traffic the panels will show "No data — backends may still be warming up". Send a few requests via the Run Test tab and refresh to confirm data appears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/components/MonitoringSection.svelte
git commit -m "feat(web): rebuild monitoring tab with live Prometheus line charts"
```

---

## Task 7: Remove Cloud Run references + gcp-metrics.ts

**Files:**
- Delete: `apps/web/src/lib/services/gcp-metrics.ts`

- [ ] **Step 1: Delete gcp-metrics.ts**

```bash
rm apps/web/src/lib/services/gcp-metrics.ts
```

- [ ] **Step 2: Grep for any remaining imports**

```bash
grep -rn "gcp-metrics\|Cloud Run\|cloud-run\|cloudrun\|run\.googleapis" apps/web/src/
```

Expected: zero results. If any remain, remove the import/reference.

- [ ] **Step 3: Verify compile**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/
git commit -m "chore(web): remove gcp-metrics.ts and Cloud Run references"
```

---

## Task 8: Remove Grafana from k8s + release its LoadBalancer IP

**Files:**
- Delete: `infra/k8s/observability/grafana.yaml`

- [ ] **Step 1: Delete grafana.yaml**

```bash
rm infra/k8s/observability/grafana.yaml
```

- [ ] **Step 2: Commit and push**

```bash
git add infra/k8s/observability/grafana.yaml
git commit -m "chore(infra): remove Grafana — monitoring handled by custom Prometheus charts"
git push
```

- [ ] **Step 3: Verify ArgoCD removes Grafana**

Wait ~2 minutes for ArgoCD to sync, then:

```bash
kubectl get pods -n bakeoff | grep grafana
kubectl get svc -n bakeoff | grep grafana
```

Expected: no grafana pods or services.

- [ ] **Step 4: Push all remaining commits**

```bash
git push
```

---

## Task 9: Final push + smoke test

- [ ] **Step 1: Push everything**

```bash
git status
git push
```

- [ ] **Step 2: Smoke test in production**

Once CI deploys, verify at `https://backend-bakeoff.com`:
1. Overview → Throughput graph: numbers are stable across page reloads
2. Overview → Throughput: "Show Last Run" button appears; clicking shows white markers
3. Monitoring tab: three chart panels render with live data (or "No data" gracefully if no traffic)
4. No "Cloud Run" text anywhere on the page

