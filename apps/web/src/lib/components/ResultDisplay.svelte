<script lang="ts">
  import { activeRuntime, testResults, isRunningTest, runtimes } from '$lib/stores/runtimeStore.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function runTest() {
    const runtime = $activeRuntime;
    if (!runtime) return;

    isRunningTest.set(true);

    setTimeout(() => {
      const variance = (Math.random() - 0.5) * 4;
      const latency = Math.max(3, Math.min(20, runtime.avgLatency + variance));
      const db = Math.round((latency * 0.35) * 10) / 10;
      const logic = Math.round((latency * 0.4) * 10) / 10;
      const network = Math.round((latency * 0.25) * 10) / 10;

      testResults.set({
        latency: Math.round(latency * 10) / 10,
        db,
        logic,
        network,
        timestamp: new Date().toLocaleTimeString(),
      });

      isRunningTest.set(false);
    }, 1200);
  }

  function getRuntimeColor(id: string): string {
    return runtimes.find(r => r.id === id)?.color ?? '#64748b';
  }
</script>

{#if $activeRuntime}
  <div class="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
    <!-- Header with accent bar -->
    <div class="flex items-center gap-4 p-6 border-b border-slate-800">
      <div
        class="w-1 h-12 rounded-full flex-shrink-0"
        style="background-color: {getRuntimeColor($activeRuntime.id)}; box-shadow: 0 0 12px {getRuntimeColor($activeRuntime.id)}44;"
      />
      <div>
        <h2 class="text-white text-xl font-bold tracking-tight">
          {$activeRuntime.name} <span class="text-slate-500 font-normal">/ {$activeRuntime.framework}</span>
        </h2>
        <p class="text-slate-500 text-sm mt-0.5">Performance benchmark results</p>
      </div>
    </div>

    <div class="p-6 space-y-8">
      <!-- Hero Metric -->
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="text-slate-500 text-xs uppercase tracking-widest font-medium mb-1">Response Latency</p>
          {#if $testResults}
            <div class="flex items-baseline gap-2">
              <span
                class="text-6xl font-bold tracking-tighter"
                style="color: {getRuntimeColor($activeRuntime.id)};"
              >
                {$testResults.latency}
              </span>
              <span class="text-2xl text-slate-400 font-medium">ms</span>
            </div>
          {:else}
            <div class="flex items-baseline gap-2">
              <span class="text-6xl font-bold tracking-tighter text-slate-700">—</span>
              <span class="text-2xl text-slate-500 font-medium">ms</span>
            </div>
          {/if}
        </div>

        <button
          on:click={runTest}
          disabled={$isRunningTest}
          class="px-8 py-3.5 bg-white text-slate-950 font-bold text-sm rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-start sm:self-auto"
        >
          {#if $isRunningTest}
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running...
          {:else}
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run Test Now
          {/if}
        </button>
      </div>

      <!-- Timing Breakdown -->
      {#if $testResults}
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-slate-400 text-sm font-medium">Timing Breakdown</p>
            <p class="text-slate-500 text-xs">Last run: {$testResults.timestamp}</p>
          </div>

          <!-- Stacked Bar -->
          <div class="w-full h-4 rounded-full overflow-hidden flex bg-slate-800">
            <div
              class="h-full transition-all duration-700 ease-out"
              style="width: {($testResults.db / $testResults.latency) * 100}%; background-color: #5DCAA5;"
            />
            <div
              class="h-full transition-all duration-700 ease-out"
              style="width: {($testResults.logic / $testResults.latency) * 100}%; background-color: #FAC775;"
            />
            <div
              class="h-full transition-all duration-700 ease-out"
              style="width: {($testResults.network / $testResults.latency) * 100}%; background-color: #AFA9EC;"
            />
          </div>

          <!-- Legend -->
          <div class="flex flex-wrap gap-6">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full" style="background-color: #5DCAA5;" />
              <span class="text-slate-400 text-xs">Database <span class="text-slate-300 font-medium">{$testResults.db}ms</span></span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full" style="background-color: #FAC775;" />
              <span class="text-slate-400 text-xs">Logic <span class="text-slate-300 font-medium">{$testResults.logic}ms</span></span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full" style="background-color: #AFA9EC;" />
              <span class="text-slate-400 text-xs">Network <span class="text-slate-300 font-medium">{$testResults.network}ms</span></span>
            </div>
          </div>
        </div>
      {:else}
        <!-- Placeholder -->
        <div class="border-2 border-dashed border-slate-800 rounded-xl p-12 text-center">
          <svg class="mx-auto h-10 w-10 text-slate-700 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <p class="text-slate-500 text-sm font-medium">Select a runtime and click "Run Test Now" to see results</p>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-16 text-center">
    <svg class="mx-auto h-12 w-12 text-slate-700 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
    <p class="text-slate-500 text-sm font-medium">Choose a runtime above to get started</p>
  </div>
{/if}