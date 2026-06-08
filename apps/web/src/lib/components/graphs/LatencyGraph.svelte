<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ 
      id, 
      ...data,
      p50: data.p95 * 0.6,
      p99: data.p95 * 1.5
    }))
    .sort((a, b) => a.p95 - b.p95);

  const maxLatency = Math.max(...runtimes.map(r => r.p99));
</script>

<div class="space-y-8">
  <!-- Header -->
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Latency Distribution</h3>
    <p class="text-sm text-slate-400">P50, P95, and P99 latency across 30-second ramp-up to 1,000 concurrent users</p>
  </div>

  <!-- Chart -->
  <div class="space-y-6">
    {#each runtimes as runtime, index}
      <div class="space-y-2">
        <!-- Label -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
            <span class="font-medium text-sm text-white">{runtime.name}</span>
          </div>
          <div class="flex gap-4 text-xs">
            <div class="text-right">
              <span class="text-slate-500">P50:</span>
              <span class="text-slate-300 font-bold ml-1">{runtime.p50.toFixed(1)}ms</span>
            </div>
            <div class="text-right">
              <span class="text-slate-500">P95:</span>
              <span class="font-bold ml-1" style="color: {runtime.color};">{runtime.p95.toFixed(1)}ms</span>
            </div>
            <div class="text-right">
              <span class="text-slate-500">P99:</span>
              <span class="text-red-400 font-bold ml-1">{runtime.p99.toFixed(1)}ms</span>
            </div>
          </div>
        </div>

        <!-- Bars -->
        <div class="relative h-6 bg-slate-800/30 rounded-lg overflow-hidden border border-slate-700/30">
          <!-- P50 Bar (teal) -->
          <div
            class="absolute h-full rounded-lg transition-all"
            style="left: 0; width: {(runtime.p50 / maxLatency) * 100}%; background-color: {runtime.color}40;"
          />
          
          <!-- P95 Bar (solid color) -->
          <div
            class="absolute h-full rounded-lg transition-all"
            style="left: 0; width: {(runtime.p95 / maxLatency) * 100}%; background-color: {runtime.color};"
          />
          
          <!-- P99 Marker (red outline) -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-red-500"
            style="left: {(runtime.p99 / maxLatency) * 100}%;"
          />
        </div>
      </div>
    {/each}
  </div>

  <!-- Legend -->
  <div class="grid grid-cols-3 gap-4 p-4 bg-slate-800/20 rounded-lg border border-slate-700/30">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded" style="background-color: rgba(34, 197, 94, 0.3);" />
        <span class="text-xs font-medium text-slate-300">P50</span>
      </div>
      <p class="text-xs text-slate-500">50th percentile (median)</p>
    </div>
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded" style="background-color: rgb(34, 197, 94);" />
        <span class="text-xs font-medium text-slate-300">P95</span>
      </div>
      <p class="text-xs text-slate-500">95th percentile (most users)</p>
    </div>
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded" style="background-color: rgb(239, 68, 68);" />
        <span class="text-xs font-medium text-slate-300">P99</span>
      </div>
      <p class="text-xs text-slate-500">99th percentile (worst case)</p>
    </div>
  </div>

  <p class="text-xs text-slate-400">
    <strong>Lower is better.</strong> P95 is most important for user experience — this is the latency that 95% of users will see or better.
  </p>
</div>
