<script lang="ts">
  import { dashboardStore, baselineData } from '$lib/stores/dashboardStore';

  function startBenchmark() {
    if ($dashboardStore.selectedRuntimes.length === 0) return;
    dashboardStore.runMultipleTests($dashboardStore.selectedRuntimes);
  }

  $: selectedCount = $dashboardStore.selectedRuntimes.length;
  $: completedCount = Object.keys($dashboardStore.testResults).length;
  $: currentRuntime = $dashboardStore.currentTestRuntime;
  $: currentRuntimeData = currentRuntime ? baselineData[currentRuntime] : null;
  $: results = Object.values($dashboardStore.testResults);
  $: isRunning = $dashboardStore.isRunning;
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Run Button or Progress -->
    {#if isRunning}
      <!-- Running State -->
      <div class="space-y-8">
        <div class="text-center space-y-3">
          <h2 class="text-2xl font-bold text-white">Running Benchmarks</h2>
          <p class="text-slate-400">Testing {selectedCount} runtimes — 500 real checkout requests each, routed through the web server</p>
        </div>

        <!-- Progress Overview -->
        <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-400">Progress</span>
            <span class="text-sm font-bold text-emerald-400">{completedCount} of {selectedCount}</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2">
            <div
              class="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
              style="width: {(completedCount / selectedCount) * 100}%"
            />
          </div>
        </div>

        <!-- Currently Testing - Animated Card -->
        {#if currentRuntime && currentRuntimeData}
          <div class="flex flex-col items-center">
            <p class="text-sm text-slate-400 mb-4 font-medium">Currently Testing</p>
            
            <!-- Animated Runtime Card -->
            <div
              class="relative group rounded-xl border-2 p-6 text-center w-full max-w-sm transition-all duration-300 animate-pulse"
              style={`
                border-color: ${currentRuntimeData.color};
                background-color: ${currentRuntimeData.color}15;
                box-shadow: 0 0 30px ${currentRuntimeData.color}44, inset 0 0 20px ${currentRuntimeData.color}22;
              `}
            >
              <!-- Glowing corner accent -->
              <div
                class="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30 animate-pulse"
                style="background-color: {currentRuntimeData.color};"
              />

              <div class="relative z-10 space-y-4">
                <!-- Runtime Info -->
                <div class="flex items-center justify-center gap-2 mb-2">
                  <div
                    class="w-4 h-4 rounded-full"
                    style="background-color: {currentRuntimeData.color};"
                  />
                  <span class="text-2xl font-bold text-white">{currentRuntimeData.name}</span>
                </div>

                <!-- Framework -->
                <div>
                  <p class="text-slate-500 text-xs uppercase tracking-widest font-medium">Framework</p>
                  <p class="text-slate-300 text-sm font-medium">{currentRuntimeData.framework}</p>
                </div>

                <!-- Baseline Stats -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-slate-800/50 rounded-lg p-3">
                    <p class="text-slate-500 text-[10px] uppercase tracking-widest">P95 Baseline</p>
                    <p class="text-xl font-bold mt-1" style="color: {currentRuntimeData.color};">
                      {currentRuntimeData.p95}<span class="text-xs font-normal text-slate-400 ml-1">ms</span>
                    </p>
                  </div>
                  <div class="bg-slate-800/50 rounded-lg p-3">
                    <p class="text-slate-500 text-[10px] uppercase tracking-widest">Success</p>
                    <p class="text-xl font-bold text-emerald-400 mt-1">{currentRuntimeData.successRate}%</p>
                  </div>
                </div>

                <!-- Loading indicator -->
                <div class="flex justify-center pt-4">
                  <div class="flex items-center gap-3">
                    <div class="animate-spin">
                      <svg class="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <span class="text-sm font-medium text-slate-300">Testing in progress...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Completed Results Building Up Below -->
        {#if results.length > 0}
          <div class="space-y-3">
            <p class="text-sm text-slate-400 font-medium text-center">Completed</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each results as result, idx}
                {@const runtimeData = baselineData[result.runtime]}
                <div
                  class="relative rounded-xl border-2 p-4 animate-in"
                  style={`
                    border-color: ${runtimeData?.color};
                    background-color: ${runtimeData?.color}10;
                    animation-delay: ${idx * 100}ms;
                  `}
                >
                  <!-- Checkmark badge -->
                  <div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <path d="M5 12l5 5L19 7" />
                    </svg>
                  </div>

                  <div class="space-y-3">
                    <!-- Header -->
                    <div class="flex items-center gap-2">
                      <div
                        class="w-3 h-3 rounded-full"
                        style="background-color: {runtimeData?.color};"
                      />
                      <span class="font-bold text-white text-sm">{runtimeData?.name}</span>
                    </div>

                    <!-- Key Metrics -->
                    <div class="space-y-2 text-xs">
                      <div class="flex justify-between">
                        <span class="text-slate-400">P95</span>
                        <span class="font-bold" style="color: {runtimeData?.color};">
                          {result.p95.toFixed(1)}ms
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-400">Success</span>
                        <span class="font-bold text-emerald-400">{result.successRate.toFixed(2)}%</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-slate-400">Throughput</span>
                        <span class="font-bold text-blue-400">{result.throughput}/s</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Ready State -->
      <div class="space-y-6">
        <div class="text-center space-y-2">
          <h2 class="text-2xl font-bold text-white">Run Benchmark</h2>
          <p class="text-slate-400">
            {selectedCount === 0
              ? 'Select at least one runtime above'
              : `Ready to test ${selectedCount} runtime${selectedCount === 1 ? '' : 's'}`}
          </p>
        </div>

        <div class="flex justify-center">
          <button
            on:click={startBenchmark}
            disabled={selectedCount === 0 || isRunning}
            class="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run Benchmark Now
          </button>
        </div>

        <p class="text-center text-xs text-slate-500 max-w-lg mx-auto">
          Demo run: 500 requests at 25 concurrency, routed from your browser through this web server to each backend.
          Latency will reflect your network + the proxy hop — not the same conditions as the isolated baseline above.
        </p>
      </div>
    {/if}
  </div>
</section>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.animate-in) {
    animation: fadeIn 400ms ease-out forwards;
    opacity: 0;
  }
</style>
