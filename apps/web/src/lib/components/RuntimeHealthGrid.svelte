<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { baselineData } from '$lib/stores/dashboardStore';
  import { queryPrometheus } from '$lib/services/prometheus';

  interface RuntimeHealth {
    id: string;
    name: string;
    color: string;
    errorRate: number | null;
    rps: number | null;
    status: 'healthy' | 'degraded' | 'critical' | 'offline';
  }

  const RUNTIMES = Object.entries(baselineData).map(([id, d]) => ({
    id,
    name: d.name,
    color: d.color,
  }));

  const REFRESH_MS = 15_000;

  let healthData: RuntimeHealth[] = RUNTIMES.map((r) => ({
    ...r,
    errorRate: null,
    rps: null,
    status: 'offline',
  }));
  let interval: ReturnType<typeof setInterval>;

  async function getRuntimeInstantHealth(runtime: string): Promise<{ errorRate: number | null; rps: number | null }> {
    // Try http_requests_total first (Go, Node, Python, Rust)
    let [errorResults, totalResults] = await Promise.all([
      queryPrometheus(`sum(rate(http_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."}[5m]))`),
      queryPrometheus(`sum(rate(http_requests_total{instance=~"bo-${runtime}:.*"}[5m]))`),
    ]);

    // Fallback to checkout metrics (Rust old / PHP)
    if (totalResults.length === 0) {
      [errorResults, totalResults] = await Promise.all([
        queryPrometheus(`sum(rate(checkout_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."}[5m]))`),
        queryPrometheus(`sum(rate(checkout_requests_total{instance=~"bo-${runtime}:.*"}[5m]))`),
      ]);
    }

    if (totalResults.length === 0) return { errorRate: null, rps: null };

    const rps = totalResults[0].value;
    const errors = errorResults[0]?.value ?? 0;
    const errorRate = rps > 0 ? (errors / rps) * 100 : 0;
    return { errorRate, rps };
  }

  function classify(errorRate: number | null, rps: number | null): RuntimeHealth['status'] {
    if (errorRate === null || rps === null) return 'offline';
    if (rps === 0) return 'offline';
    if (errorRate >= 5) return 'critical';
    if (errorRate >= 1) return 'degraded';
    return 'healthy';
  }

  async function loadAll() {
    const results = await Promise.all(RUNTIMES.map((r) => getRuntimeInstantHealth(r.id)));
    healthData = RUNTIMES.map((r, i) => {
      const { errorRate, rps } = results[i];
      return {
        ...r,
        errorRate,
        rps,
        status: classify(errorRate, rps),
      };
    });
  }

  onMount(() => {
    loadAll();
    interval = setInterval(loadAll, REFRESH_MS);
  });

  onDestroy(() => clearInterval(interval));

  const statusConfig = {
    healthy:  { label: 'Healthy',  bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', dot: 'bg-emerald-400', text: 'text-emerald-300' },
    degraded: { label: 'Degraded', bg: 'bg-amber-900/40',   border: 'border-amber-700/50',   dot: 'bg-amber-400',   text: 'text-amber-300'   },
    critical: { label: 'Critical', bg: 'bg-red-900/40',     border: 'border-red-700/50',     dot: 'bg-red-400',     text: 'text-red-300'     },
    offline:  { label: 'No data',  bg: 'bg-slate-800/40',   border: 'border-slate-700/40',   dot: 'bg-slate-500',   text: 'text-slate-400'   },
  };
</script>

<div class="space-y-3">
  <div>
    <h3 class="text-base font-semibold text-white">Error Rate Status</h3>
    <p class="text-sm text-slate-400">5xx rate over last 5 minutes · healthy &lt;1% · degraded 1–5% · critical &gt;5%</p>
  </div>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    {#each healthData as runtime}
      {@const cfg = statusConfig[runtime.status]}
      <div class="rounded-lg border {cfg.border} {cfg.bg} p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-white">{runtime.name}</span>
          <span class="w-2 h-2 rounded-full {cfg.dot} flex-shrink-0"></span>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-slate-400">Error rate</div>
          <div class="text-lg font-mono font-semibold {cfg.text}">
            {#if runtime.errorRate !== null}
              {runtime.errorRate.toFixed(2)}%
            {:else}
              —
            {/if}
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-xs text-slate-400">Throughput</div>
          <div class="text-sm font-mono text-slate-300">
            {#if runtime.rps !== null && runtime.rps > 0}
              {runtime.rps >= 1 ? runtime.rps.toFixed(1) : runtime.rps.toFixed(3)} rps
            {:else}
              — rps
            {/if}
          </div>
        </div>

        <div class="text-xs {cfg.text} font-medium">{cfg.label}</div>
      </div>
    {/each}
  </div>
</div>
