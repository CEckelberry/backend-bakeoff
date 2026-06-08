<script lang="ts">
  import { activeGraph } from '$lib/stores/dashboardStore';
  import GraphSwitcher from '$lib/components/GraphSwitcher.svelte';
  import ThroughputGraph from '$lib/components/graphs/ThroughputGraph.svelte';
  import LatencyGraph from '$lib/components/graphs/LatencyGraph.svelte';
  import ResourceEfficiencyGraph from '$lib/components/graphs/ResourceEfficiencyGraph.svelte';
  import ReliabilityGraph from '$lib/components/graphs/ReliabilityGraph.svelte';
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Switcher -->
    <GraphSwitcher />

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
