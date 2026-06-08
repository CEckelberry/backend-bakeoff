<script lang="ts">
  import { activeRuntime, comparisonRuntime, isComparing, showComparisonModal, testResults, runtimes } from '$lib/stores/runtimeStore.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function openModal() {
    showComparisonModal.set(true);
  }

  function selectComparison(runtime: typeof runtimes[number]) {
    if (runtime.id === $activeRuntime?.id) return;
    comparisonRuntime.set(runtime);
    isComparing.set(true);
    showComparisonModal.set(false);
    dispatch('comparison-selected', runtime);
  }

  function toggleComparison() {
    if ($isComparing) {
      isComparing.set(false);
      comparisonRuntime.set(null);
      dispatch('comparison-cleared');
    }
  }

  function getDelta(): { value: number; label: string; color: string } | null {
    if (!$isComparing || !$activeRuntime || !$comparisonRuntime || !$testResults) return null;

    const baseLatency = $comparisonRuntime.avgLatency;
    const currentLatency = $testResults.latency;
    const delta = ((currentLatency - baseLatency) / baseLatency) * 100;

    if (delta > 0) {
      return { value: delta, label: 'slower', color: '#F87171' };
    } else if (delta < 0) {
      return { value: Math.abs(delta), label: 'faster', color: '#34D399' };
    }
    return { value: 0, label: 'equal', color: '#94A3B8' };
  }

  $: delta = getDelta();
</script>

<!-- Comparison Toggle Button -->
{#if !$isComparing}
  <button
    on:click={openModal}
    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-all duration-150"
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 00-8 0V22M20 22v-5a4 4 0 00-8 0V22" />
    </svg>
    Compare with...
  </button>
{:else}
  <div class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full" style="background-color: {$activeRuntime?.color};" />
        <span class="text-white text-sm font-medium">{$activeRuntime?.name}</span>
      </div>
      <svg class="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full" style="background-color: {$comparisonRuntime?.color};" />
        <span class="text-white text-sm font-medium">{$comparisonRuntime?.name}</span>
      </div>
    </div>

    {#if delta}
      <div class="flex items-center gap-1.5 pl-3 border-l border-slate-700">
        <span class="text-sm font-bold" style="color: {delta.color};">
          {delta.value > 0 ? '+' : ''}{delta.value.toFixed(1)}%
        </span>
        <span class="text-xs" style="color: {delta.color};">{delta.label}</span>
      </div>
    {/if}

    <button
      on:click={toggleComparison}
      class="ml-1 p-1 rounded-md hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
      title="Remove comparison"
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
{/if}

<!-- Comparison Modal -->
{#if $showComparisonModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    on:click={(e) => { if (e.target === e.currentTarget) showComparisonModal.set(false); }}
  >
    <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

    <div class="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
      <div class="p-6 border-b border-slate-800">
        <h3 class="text-white text-lg font-bold">Compare with...</h3>
        <p class="text-slate-500 text-sm mt-1">Choose a runtime to compare against {$activeRuntime?.name}</p>
      </div>

      <div class="p-3 max-h-80 overflow-y-auto">
        {#each runtimes as runtime}
          {#if runtime.id !== $activeRuntime?.id}
            <button
              on:click={() => selectComparison(runtime)}
              class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors text-left"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style="background-color: {runtime.color}22; border: 1px solid {runtime.color}44;"
              >
                <span class="text-sm font-bold" style="color: {runtime.color};">{runtime.name[0]}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium">{runtime.name}</p>
                <p class="text-slate-500 text-xs">{runtime.framework} · {runtime.avgLatency}ms avg</p>
              </div>
              <svg class="h-4 w-4 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          {/if}
        {/each}
      </div>

      <div class="p-3 border-t border-slate-800">
        <button
          on:click={() => showComparisonModal.set(false)}
          class="w-full py-2.5 text-slate-500 text-sm font-medium hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}