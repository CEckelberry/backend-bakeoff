<script lang="ts">
  import { onMount } from 'svelte';
  import { activeGraph } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import GraphSwitcher from '$lib/components/GraphSwitcher.svelte';
  import ThroughputGraph from '$lib/components/graphs/ThroughputGraph.svelte';
  import LatencyGraph from '$lib/components/graphs/LatencyGraph.svelte';
  import ResourceEfficiencyGraph from '$lib/components/graphs/ResourceEfficiencyGraph.svelte';
  import ReliabilityGraph from '$lib/components/graphs/ReliabilityGraph.svelte';

  onMount(() => lastRunStore.fetch());

  function toggleLastRun() {
    showLastRun.update((v) => !v);
  }
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Switcher + Last Run toggle -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <GraphSwitcher />
      <button
        on:click={toggleLastRun}
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 {$showLastRun ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-slate-700 text-slate-400 hover:border-slate-500'}"
        disabled={$lastRunStore.loading || !$lastRunStore.data}
      >
        {#if $lastRunStore.loading}
          Loading…
        {:else if !$lastRunStore.data}
          No run data
        {:else}
          {$showLastRun ? '✓ Last Run' : 'Show Last Run'}
        {/if}
      </button>
    </div>

    <!-- Active Graph -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
      {#if $activeGraph === 'throughput'}
        <ThroughputGraph />
      {:else if $activeGraph === 'latency'}
        <LatencyGraph />
      {:else if $activeGraph === 'resources'}
        <ResourceEfficiencyGraph />
      {:else if $activeGraph === 'reliability'}
        <ReliabilityGraph />
      {/if}
    </div>
  </div>
</section>
