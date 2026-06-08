<script lang="ts">
  import { onMount } from 'svelte';
  import { getRuntimeLatency, getRuntimeThroughput, getRuntimeErrorRate, debugRuntimeMetrics } from '$lib/services/prometheus';
  import { baselineData } from '$lib/stores/dashboardStore';

  interface LiveMetrics {
    runtime: string;
    p95: number;
    p99: number;
    throughput: number;
    errorRate: number;
    loading: boolean;
    error?: string;
  }

  const runtimes = ['rust', 'go', 'bun', 'node', 'python', 'php'];
  let metrics: Record<string, LiveMetrics> = {};
  let isRefreshing = false;
  let lastUpdate = new Date().toLocaleTimeString();

  onMount(() => {
    // Initial load
    refreshMetrics();

    // Poll every 5 seconds
    const interval = setInterval(refreshMetrics, 5000);

    return () => clearInterval(interval);
  });

  async function refreshMetrics() {
    isRefreshing = true;
    lastUpdate = new Date().toLocaleTimeString();

    for (const runtime of runtimes) {
      if (!metrics[runtime]) {
        metrics[runtime] = { runtime, p95: 0, p99: 0, throughput: 0, errorRate: 0, loading: true };
      } else {
        metrics[runtime].loading = true;
      }
    }

    const promises = runtimes.map(async (runtime) => {
      try {
        const [latency, throughput, errorRate] = await Promise.all([
          getRuntimeLatency(runtime),
          getRuntimeThroughput(runtime),
          getRuntimeErrorRate(runtime),
        ]);

        metrics[runtime] = {
          runtime,
          p95: latency.p95,
          p99: latency.p99,
          throughput: throughput,
          errorRate: errorRate,
          loading: false,
        };

        console.log(`[Prometheus] ${runtime}:`, { p95: latency.p95.toFixed(2), throughput });
      } catch (error) {
        console.error(`Failed to fetch metrics for ${runtime}:`, error);
        metrics[runtime].loading = false;
        metrics[runtime].error = 'Failed to fetch';
      }
    });

    await Promise.all(promises);
    isRefreshing = false;
  }

  async function debugMetrics(runtime: string) {
    console.log(`Debugging ${runtime}...`);
    await debugRuntimeMetrics(runtime);
  }
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <h2 class="text-2xl font-bold text-white">Live Prometheus Metrics</h2>
        <p class="text-slate-400 text-sm">Real-time performance data (Last update: {lastUpdate})</p>
      </div>
      <button
        on:click={refreshMetrics}
        disabled={isRefreshing}
        class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2"
      >
        <svg
          class={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64M3.51 15A9 9 0 0 0 18.36 18.36" />
        </svg>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each runtimes as runtime (runtime)}
        {@const runtimeData = baselineData[runtime]}
        {@const metric = metrics[runtime]}

        <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
          <!-- Runtime Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-700">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background-color: {runtimeData?.color};" />
              <h3 class="font-bold text-white">{runtimeData?.name} <span class="text-slate-400 font-normal text-sm">({runtimeData?.framework})</span></h3>
            </div>
            {#if metric?.loading}
              <svg class="w-4 h-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            {:else if metric?.error}
              <svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4v.01" stroke="white" stroke-width="2" />
              </svg>
            {:else}
              <div class="w-2 h-2 rounded-full bg-emerald-500" />
            {/if}
          </div>

          {#if metric?.error}
            <div class="text-sm text-red-400 py-4">
              {metric.error}
            </div>
          {:else}
            <!-- Metrics -->
            <div class="space-y-3">
              <!-- P95 -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 uppercase tracking-widest font-medium">P95 Latency</p>
                  <p class="text-2xl font-bold mt-1" style="color: {runtimeData?.color};">
                    {metric?.p95 > 0 ? metric.p95.toFixed(1) : '—'}<span class="text-xs font-normal text-slate-400 ml-1">ms</span>
                  </p>
                </div>
                <div class="w-12 h-12 rounded-lg bg-slate-800/50 flex items-center justify-center">
                  <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H3v10h10V2z" />
                    <path d="M21 2h-10v10h10V2z" />
                    <path d="M13 12H3v10h10v-10z" />
                    <path d="M21 12h-10v10h10v-10z" />
                  </svg>
                </div>
              </div>

              <!-- P99 -->
              <div class="bg-slate-800/20 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 uppercase tracking-widest">P99</p>
                  <p class="text-sm font-bold text-slate-300 mt-1">{metric?.p99 > 0 ? metric.p99.toFixed(1) : '—'}ms</p>
                </div>
                <span class="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">worst case</span>
              </div>

              <!-- Throughput -->
              <div class="bg-slate-800/20 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p class="text-xs text-slate-500 uppercase tracking-widest">Throughput</p>
                  <p class="text-sm font-bold text-blue-400 mt-1">{metric?.throughput || '—'}/s</p>
                </div>
                <span class="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">req/sec</span>
              </div>

              <!-- Error Rate -->
              {#if metric?.errorRate > 0}
                <div class="bg-slate-800/20 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p class="text-xs text-slate-500 uppercase tracking-widest">Errors</p>
                    <p class="text-sm font-bold text-amber-400 mt-1">{metric.errorRate.toFixed(2)}%</p>
                  </div>
                  <span class="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">failed</span>
                </div>
              {/if}
            </div>

            <!-- Baseline Comparison -->
            <div class="pt-2 border-t border-slate-700/50 text-xs">
              <p class="text-slate-500">Baseline: {runtimeData?.p95}ms</p>
              <p class="text-slate-500">Success: {runtimeData?.successRate}%</p>
            </div>
          {/if}

          <!-- Debug button (dev only) -->
          <button
            on:click={() => debugMetrics(runtime)}
            class="text-xs text-slate-500 hover:text-slate-400 w-full text-right pt-2 border-t border-slate-700/20"
          >
            debug
          </button>
        </div>
      {/each}
    </div>

    <!-- Info Box -->
    <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-4 text-sm text-slate-400">
      <p>
        💡 <strong>Real-time Monitoring:</strong> These metrics are pulled directly from Prometheus. Values show P95/P99 latencies and throughput for each runtime.
        <strong>Note:</strong> Metrics appear when benchmarks are running or when the backends receive requests.
      </p>
    </div>
  </div>
</section>
