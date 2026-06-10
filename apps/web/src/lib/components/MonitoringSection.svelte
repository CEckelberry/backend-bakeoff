<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { baselineData } from '$lib/stores/dashboardStore';
  import { getRuntimeLatencyHistory, getRuntimeP99History, getRuntimeThroughputHistory, getRuntimeMemoryHistory, getRuntimeApdexHistory } from '$lib/services/prometheus';
  import PrometheusLineChart from '$lib/components/graphs/PrometheusLineChart.svelte';
  import RuntimeHealthGrid from '$lib/components/RuntimeHealthGrid.svelte';

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
  let p99Series: ChartSeries[] = [];
  let throughputSeries: ChartSeries[] = [];
  let memorySeries: ChartSeries[] = [];
  let apdexSeries: ChartSeries[] = [];
  let lastFetched: Date | null = null;
  let interval: ReturnType<typeof setInterval>;
  let isLoading = false;

  async function loadAll() {
    if (isLoading) return;
    isLoading = true;
    try {
      const [latencyResults, p99Results, throughputResults, memoryResults, apdexResults] = await Promise.all([
        Promise.all(RUNTIMES.map(async (r) => ({ ...r, points: await getRuntimeLatencyHistory(r.id, WINDOW_MINUTES) }))),
        Promise.all(RUNTIMES.map(async (r) => ({ ...r, points: await getRuntimeP99History(r.id, WINDOW_MINUTES) }))),
        Promise.all(RUNTIMES.map(async (r) => ({ ...r, points: await getRuntimeThroughputHistory(r.id, WINDOW_MINUTES) }))),
        Promise.all(RUNTIMES.map(async (r) => ({ ...r, points: await getRuntimeMemoryHistory(r.id, WINDOW_MINUTES) }))),
        Promise.all(RUNTIMES.map(async (r) => ({ ...r, points: await getRuntimeApdexHistory(r.id, WINDOW_MINUTES) }))),
      ]);

      latencySeries = latencyResults;
      p99Series = p99Results;
      throughputSeries = throughputResults;
      memorySeries = memoryResults;
      apdexSeries = apdexResults;
      lastFetched = new Date();
    } finally {
      isLoading = false;
    }
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
      title="P99 Latency"
      subtitle="99th percentile (tail latency) — shows worst-case user experience"
      series={p99Series}
      yFormatter={(v) => `${v.toFixed(1)}ms`}
    />

    <PrometheusLineChart
      title="Throughput"
      subtitle="Requests per second — higher is better"
      series={throughputSeries}
      yFormatter={(v) => `${fmt(v)} rps`}
    />

    <RuntimeHealthGrid />

    <PrometheusLineChart
      title="Memory Usage"
      subtitle="Resident memory (RSS) in MB — lower footprint = more efficient runtime"
      series={memorySeries}
      yFormatter={(v) => `${v.toFixed(0)}MB`}
    />

    <PrometheusLineChart
      title="Apdex Score"
      subtitle="User satisfaction index (0–1) · satisfied <50ms · tolerating <250ms · higher is better"
      series={apdexSeries}
      yFormatter={(v) => v.toFixed(3)}
    />

  </div>
</section>
