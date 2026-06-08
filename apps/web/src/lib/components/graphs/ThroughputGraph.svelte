<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ 
      id, 
      ...data,
      throughput: Math.floor(800 + Math.random() * 800) // Mock throughput
    }))
    .sort((a, b) => b.throughput - a.throughput);

  const maxThroughput = Math.max(...runtimes.map(r => r.throughput));
</script>

<div class="space-y-8">
  <!-- Header -->
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Throughput</h3>
    <p class="text-sm text-slate-400">Successful checkouts per second under load (1,000 concurrent users)</p>
  </div>

  <!-- Chart -->
  <div class="space-y-4">
    {#each runtimes as runtime, index}
      <div class="space-y-2">
        <!-- Label -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
            <span class="font-medium text-sm text-white">{runtime.name}</span>
          </div>
          <span class="font-bold text-lg" style="color: {runtime.color};">{runtime.throughput}</span>
        </div>

        <!-- Bar -->
        <div class="h-8 bg-slate-800/50 rounded-lg overflow-hidden">
          <div
            class="h-full rounded-lg transition-all duration-500 flex items-center px-3"
            style="width: {(runtime.throughput / maxThroughput) * 100}%; background-color: {runtime.color};"
          >
            {#if (runtime.throughput / maxThroughput) * 100 > 30}
              <span class="text-xs font-bold text-slate-950">/sec</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Legend -->
  <div class="p-4 bg-slate-800/20 rounded-lg border border-slate-700/30">
    <p class="text-xs text-slate-400">
      <strong>Higher is better.</strong> Throughput measures how many checkout transactions each runtime can complete per second at peak load.
    </p>
  </div>
</div>
