<script lang="ts">
  import { onMount } from 'svelte';
  import { baselineData } from '$lib/stores/dashboardStore';

  interface BenchmarkRun {
    runtime: string;
    p95: number;
    throughput: number;
    timestamp: Date;
  }

  let benchmarkHistory: BenchmarkRun[] = [];
  let isDeployedToCloud = false;
  let cloudMetrics: any[] = [];
  let latestByRuntime: Record<string, BenchmarkRun | undefined> = {};

  onMount(() => {
    // Quick check for cloud environment - avoid blocking operations
    if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_GCP_PROJECT) {
      isDeployedToCloud = true;
    }
    
    // Load benchmark history asynchronously to avoid blocking
    setTimeout(() => {
      loadBenchmarkHistory();
    }, 0);
  });

  function loadBenchmarkHistory() {
    try {
      const stored = localStorage.getItem('benchmarkHistory');
      if (stored) {
        benchmarkHistory = JSON.parse(stored).map((b: any) => ({
          ...b,
          timestamp: new Date(b.timestamp)
        }));
        // Pre-compute latest by runtime
        buildLatestCache();
      }
    } catch (error) {
      console.error('Failed to load benchmark history:', error);
    }
  }

  function buildLatestCache() {
    latestByRuntime = {};
    for (const runtime of ['rust', 'go', 'bun', 'node', 'python', 'php']) {
      const entries = benchmarkHistory.filter(b => b.runtime === runtime);
      if (entries.length > 0) {
        entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        latestByRuntime[runtime] = entries[0];
      }
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- Header -->
    <div class="space-y-2">
      <h2 class="text-2xl font-bold text-white">📊 Benchmark History</h2>
      <p class="text-slate-400 text-sm">
        {#if isDeployedToCloud}
          Cloud Run Deployment • Real-time metrics from GCP
        {:else}
          Local Development • Run benchmarks in the "Run Test" tab to populate results
        {/if}
      </p>
    </div>

    {#if benchmarkHistory.length === 0}
      <!-- Empty State -->
      <div class="bg-slate-800/30 rounded-lg border border-slate-700/50 p-8 text-center">
        <p class="text-slate-400 mb-2">📈 No benchmark results yet</p>
        <p class="text-slate-500 text-sm">
          Go to <strong>[🚀 Run Test]</strong> tab and run a benchmark to see results here
        </p>
      </div>
    {:else}
      <!-- Results Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each ['rust', 'go', 'bun', 'node', 'python', 'php'] as runtime}
          {@const latest = latestByRuntime[runtime]}
          {@const baseline = $baselineData.find(b => b.runtime === runtime)}
          {@const color = baseline?.color || 'bg-slate-700'}

          <div
            class="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 hover:border-slate-500/50 transition-all"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="font-semibold capitalize text-white">{runtime}</span>
              <div class={`w-2 h-2 rounded-full ${color}`}></div>
            </div>

            {#if latest}
              <div class="space-y-3">
                <div>
                  <p class="text-slate-400 text-xs uppercase tracking-wider">P95 Latency</p>
                  <p class="text-xl font-bold text-emerald-400">{latest.p95.toFixed(1)}ms</p>
                  {#if baseline}
                    <p class="text-xs text-slate-500 mt-1">
                      vs {baseline.p95}ms baseline
                    </p>
                  {/if}
                </div>
                <div>
                  <p class="text-slate-400 text-xs uppercase tracking-wider">Throughput</p>
                  <p class="text-xl font-bold text-blue-400">{Math.round(latest.throughput)} req/s</p>
                </div>
                <p class="text-xs text-slate-500 text-right">
                  {formatTime(latest.timestamp)}
                </p>
              </div>
            {:else}
              <p class="text-slate-500 text-sm italic">No results yet</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Cloud Run Info -->
    {#if !isDeployedToCloud}
      <div class="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4 text-sm text-slate-400 mt-8">
        <p class="mb-2">
          <strong>💡 Cloud Run Deployment:</strong>
        </p>
        <p class="text-xs text-slate-500">
          Deploy this dashboard to Cloud Run with environment variable <code class="bg-slate-950 px-2 py-1 rounded">PUBLIC_GCP_PROJECT</code> 
          to see real-time metrics like cold start time, memory usage, and CPU utilization.
        </p>
      </div>
    {/if}
  </div>
</section>

<style>
  code {
    font-family: 'Monaco', 'Courier New', monospace;
  }
</style>
