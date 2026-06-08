<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ 
      id, 
      ...data,
      memory: Math.floor(150 + Math.random() * 250), // MB
      cpu: Math.floor(20 + Math.random() * 60), // %
      dbConnections: Math.floor(8 + Math.random() * 12) // out of 20
    }))
    .sort((a, b) => (a.memory + a.cpu + a.dbConnections) - (b.memory + b.cpu + b.dbConnections));
</script>

<div class="space-y-8">
  <!-- Header -->
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Resource Efficiency</h3>
    <p class="text-sm text-slate-400">Memory, CPU, and database connection usage under peak load</p>
  </div>

  <!-- Chart Grid -->
  <div class="space-y-6">
    {#each runtimes as runtime, index}
      <div class="space-y-3">
        <!-- Label -->
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
          <span class="font-medium text-sm text-white">{runtime.name} <span class="text-slate-400 font-normal">({runtime.framework})</span></span>
        </div>

        <!-- Resource Bars -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Memory -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Memory</span>
              <span class="text-sm font-bold text-white">{runtime.memory}MB</span>
            </div>
            <div class="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                style="width: {(runtime.memory / 400) * 100}%; background-color: {runtime.color};"
              />
            </div>
          </div>

          <!-- CPU -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">CPU</span>
              <span class="text-sm font-bold text-white">{runtime.cpu}%</span>
            </div>
            <div class="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                style="width: {runtime.cpu}%; background-color: {runtime.color};"
              />
            </div>
          </div>

          <!-- DB Connections -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">DB Conns</span>
              <span class="text-sm font-bold text-white">{runtime.dbConnections}/20</span>
            </div>
            <div class="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                style="width: {(runtime.dbConnections / 20) * 100}%; background-color: {runtime.color};"
              />
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Legend -->
  <div class="p-4 bg-slate-800/20 rounded-lg border border-slate-700/30 space-y-3">
    <p class="text-xs text-slate-400">
      <strong>Lower is generally better.</strong> But context matters:
    </p>
    <ul class="text-xs text-slate-400 space-y-1 ml-2">
      <li>• <strong>Memory:</strong> Lower footprint means better resource utilization</li>
      <li>• <strong>CPU:</strong> Lower CPU usage means more headroom for scaling</li>
      <li>• <strong>DB Connections:</strong> Fewer connections = less database pressure</li>
    </ul>
  </div>
</div>
