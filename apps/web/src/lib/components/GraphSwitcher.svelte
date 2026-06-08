<script lang="ts">
  import { activeGraph } from '$lib/stores/dashboardStore';

  interface GraphOption {
    id: 'throughput' | 'latency' | 'resources' | 'reliability';
    label: string;
    icon: string;
    description: string;
  }

  const graphs: GraphOption[] = [
    { 
      id: 'throughput', 
      label: 'Throughput', 
      icon: '⚡',
      description: 'Checkouts per second'
    },
    { 
      id: 'latency', 
      label: 'Latency', 
      icon: '⏱️',
      description: 'P50, P95, P99'
    },
    { 
      id: 'resources', 
      label: 'Resources', 
      icon: '💾',
      description: 'Memory, CPU, DB'
    },
    { 
      id: 'reliability', 
      label: 'Reliability', 
      icon: '🛡️',
      description: 'Error rates'
    },
  ];
</script>

<div class="flex flex-col sm:flex-row gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
  <div class="text-sm text-slate-400 font-medium">Choose metric:</div>
  <div class="flex flex-wrap gap-2">
    {#each graphs as graph}
      <button
        on:click={() => activeGraph.set(graph.id)}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
        class:bg-emerald-500={$activeGraph === graph.id}
        class:text-white={$activeGraph === graph.id}
        class:bg-slate-700={$activeGraph !== graph.id}
        class:text-slate-300={$activeGraph !== graph.id}
        class:hover:bg-slate-600={$activeGraph !== graph.id}
      >
        <span>{graph.icon}</span>
        <span>{graph.label}</span>
      </button>
    {/each}
  </div>
</div>
