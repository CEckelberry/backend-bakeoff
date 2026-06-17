<script lang="ts">
  import { onMount } from 'svelte';
  import { dashboardStore, baselineData } from '$lib/stores/dashboardStore';

  $: results = Object.values($dashboardStore.testResults);
  $: hasResults = results.length > 0 && !$dashboardStore.isRunning;
  
  let lastSaveTime = 0;
  const SAVE_DEBOUNCE = 1000; // Only save once per second max

  onMount(() => {
    // Save results once when component mounts
    if (hasResults && results.length > 0) {
      saveBenchmarkResults();
    }
  });

  function saveBenchmarkResults() {
    const now = Date.now();
    // Debounce saves to prevent excessive localStorage writes
    if (now - lastSaveTime < SAVE_DEBOUNCE) {
      return;
    }
    lastSaveTime = now;
    
    try {
      const history = JSON.parse(localStorage.getItem('benchmarkHistory') || '[]');
      
      // Only add if we haven't already added these exact results
      const newResults = results.map(r => ({
        runtime: r.runtime,
        p95: r.p95,
        throughput: r.throughput,
        timestamp: new Date().toISOString()
      }));
      
      // Check if these results already exist (avoid duplicates)
      const lastEntry = history[history.length - 1];
      if (lastEntry && 
          lastEntry.timestamp === newResults[0]?.timestamp &&
          newResults.length === results.length) {
        return; // Already saved
      }
      
      history.push(...newResults);
      
      // Keep only last 50 results
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }
      
      localStorage.setItem('benchmarkHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save benchmark results:', error);
    }
  }

  function benchmarkAgain() {
    dashboardStore.benchmarkAgain();
  }
</script>

{#if hasResults}
  <section class="bg-slate-950 text-slate-100 py-8 px-6">
    <div class="max-w-6xl mx-auto space-y-12">
      <!-- Results Header -->
      <div class="space-y-2">
        <h2 class="text-3xl font-bold text-white">✓ Demo Run Complete</h2>
        <p class="text-slate-400">All {results.length} runtime{results.length === 1 ? '' : 's'} tested</p>
        <p class="text-xs text-slate-500">
          These numbers reflect browser → web server → backend latency under light load.
          See the Overview tab for the authoritative isolated baseline (10k requests, 20 threads, direct backend).
        </p>
      </div>

      <!-- Benchmark Again Button -->
      <div class="flex justify-center">
        <button
          on:click={benchmarkAgain}
          class="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64M3.51 15A9 9 0 0 0 18.36 18.36" />
          </svg>
          Benchmark Again
        </button>
      </div>

      <!-- Results Grid with Full Details -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each results as result}
          {@const runtimeData = baselineData[result.runtime]}
          <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 space-y-6">
            <!-- Runtime Header -->
            <div class="flex items-center gap-3 pb-4 border-b border-slate-700">
              <div
                class="w-4 h-4 rounded-full"
                style="background-color: {runtimeData?.color};"
              />
              <div>
                <h3 class="font-bold text-white text-lg">{runtimeData?.name}</h3>
                <p class="text-xs text-slate-400">{runtimeData?.framework}</p>
              </div>
            </div>

            <!-- Latency Breakdown -->
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-slate-300">Latency Breakdown</h4>
              <div class="flex h-12 rounded-lg overflow-hidden gap-0 border border-slate-700">
                <div
                  class="bg-gradient-to-r from-blue-500 to-blue-600 flex flex-col items-center justify-center text-xs font-bold text-white transition-all"
                  style="width: {(result.breakdown.db / result.p95) * 100}%"
                >
                  {#if result.breakdown.db > 3}
                    <div>DB</div>
                    <div>{result.breakdown.db.toFixed(1)}ms</div>
                  {/if}
                </div>
                <div
                  class="bg-gradient-to-r from-emerald-500 to-emerald-600 flex flex-col items-center justify-center text-xs font-bold text-white transition-all"
                  style="width: {(result.breakdown.logic / result.p95) * 100}%"
                >
                  {#if result.breakdown.logic > 3}
                    <div>Logic</div>
                    <div>{result.breakdown.logic.toFixed(1)}ms</div>
                  {/if}
                </div>
                <div
                  class="bg-gradient-to-r from-amber-500 to-amber-600 flex flex-col items-center justify-center text-xs font-bold text-white transition-all"
                  style="width: {(result.breakdown.network / result.p95) * 100}%"
                >
                  {#if result.breakdown.network > 3}
                    <div>Net</div>
                    <div>{result.breakdown.network.toFixed(1)}ms</div>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Metrics Grid -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-slate-800/30 rounded-lg p-3">
                <p class="text-xs text-slate-500 uppercase">P95</p>
                <p class="text-2xl font-bold mt-1" style="color: {runtimeData?.color};">
                  {result.p95.toFixed(1)}<span class="text-xs font-normal text-slate-400 ml-1">ms</span>
                </p>
              </div>
              <div class="bg-slate-800/30 rounded-lg p-3">
                <p class="text-xs text-slate-500 uppercase">Success</p>
                <p class="text-2xl font-bold text-emerald-400 mt-1">{result.successRate.toFixed(2)}%</p>
              </div>
              <div class="bg-slate-800/30 rounded-lg p-3">
                <p class="text-xs text-slate-500 uppercase">Throughput</p>
                <p class="text-lg font-bold text-blue-400 mt-1">{result.throughput}/sec</p>
              </div>
              <div class="bg-slate-800/30 rounded-lg p-3">
                <p class="text-xs text-slate-500 uppercase">P50</p>
                <p class="text-lg font-bold text-slate-300 mt-1">{result.p50.toFixed(1)}ms</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>
{/if}
