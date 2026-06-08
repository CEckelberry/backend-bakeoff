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
  let isLoading = false;

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

    const errorMap = new Map(errorPts.map((p) => [p.timestamp, p.value]));
    return totalPts.map((t) => ({
      timestamp: t.timestamp,
      value: t.value > 0 ? ((errorMap.get(t.timestamp) ?? 0) / t.value) * 100 : 0,
    }));
  }

  async function loadAll() {
    if (isLoading) return;
    isLoading = true;
    try {
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
