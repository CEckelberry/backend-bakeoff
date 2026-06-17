<script lang="ts">
  import { dashboardStore, baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData).map(([id, data]) => ({
    id,
    ...data,
  }));

  function toggleRuntime(id: string) {
    dashboardStore.toggleRuntime(id);
  }
</script>

<div class="space-y-4">
  <p class="text-sm text-slate-400">Select one or more runtimes to test (tests run sequentially):</p>
  
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
    {#each runtimes as runtime (runtime.id)}
      <button
        on:click={() => toggleRuntime(runtime.id)}
        class="relative group rounded-xl border-2 p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none"
        class:border-emerald-500={$dashboardStore.selectedRuntimes.includes(runtime.id)}
        class:border-slate-700={!$dashboardStore.selectedRuntimes.includes(runtime.id)}
        style={$dashboardStore.selectedRuntimes.includes(runtime.id) 
          ? `box-shadow: 0 0 20px ${runtime.color}33; border-color: ${runtime.color}; background-color: ${runtime.color}15;`
          : 'background-color: rgb(30, 41, 59);'}
      >
        <!-- Checkbox indicator -->
        <div class="absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all" style={$dashboardStore.selectedRuntimes.includes(runtime.id) ? `border-color: ${runtime.color}; background-color: ${runtime.color}` : 'border-color: rgb(71, 85, 99)'}>
          {#if $dashboardStore.selectedRuntimes.includes(runtime.id)}
            <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M5 12l5 5L19 7" />
            </svg>
          {/if}
        </div>

        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-3">
            <div
              class="w-3 h-3 rounded-full flex-shrink-0"
              style="background-color: {runtime.color};"
            />
            <span class="text-white font-semibold text-sm tracking-wide">{runtime.name}</span>
          </div>

          <div class="space-y-2">
            <div>
              <p class="text-slate-500 text-[10px] uppercase tracking-widest font-medium">Framework</p>
              <p class="text-slate-300 text-xs font-medium mt-0.5">{runtime.framework}</p>
            </div>

            <div class="flex items-end justify-between">
              <div>
                <p class="text-slate-500 text-[10px] uppercase tracking-widest font-medium">P95 Baseline</p>
                <p class="text-white text-lg font-bold leading-tight">{runtime.p95}<span class="text-sm font-normal text-slate-400 ml-0.5">ms</span></p>
              </div>
              <div class="text-right">
                <p class="text-slate-500 text-[10px] uppercase tracking-widest font-medium">Success</p>
                <p class="text-emerald-400 text-sm font-semibold">{runtime.successRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>
