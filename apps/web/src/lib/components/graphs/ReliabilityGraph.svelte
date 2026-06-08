<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => {
      const successRate = live?.[id]?.successRate ?? data.successRate;
      return {
        id,
        ...data,
        uptime: successRate,
        errorRate: 100 - successRate,
        isLive: live?.[id]?.isLive ?? false,
      };
    })
    .sort((a, b) => a.errorRate - b.errorRate);

  $: maxErrorRate = Math.max(...runtimes.map((r) => r.errorRate), 0.001);
</script>

<div class="space-y-8">
  <!-- Header -->
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Reliability Under Load</h3>
    <p class="text-sm text-slate-400">Error rates and uptime during extreme load testing (1,000 concurrent users)</p>
  </div>

  <!-- Chart -->
  <div class="space-y-4">
    {#each runtimes as runtime, index}
      <div class="space-y-2">
        <!-- Label -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
            <span class="font-medium text-sm text-white">{runtime.name} <span class="text-slate-400 font-normal">({runtime.framework})</span></span>
          </div>
          <div class="flex gap-6">
            <div class="text-right">
              <span class="text-xs text-slate-500">Uptime:</span>
              <span class="text-sm font-bold ml-1" style="color: {runtime.color};">{runtime.uptime.toFixed(2)}%</span>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-500">Error Rate:</span>
              <span class="text-sm font-bold text-red-400 ml-1">{runtime.errorRate.toFixed(3)}%</span>
            </div>
          </div>
        </div>

        <!-- Combined Bar -->
        <div class="h-6 bg-slate-800/30 rounded-lg overflow-hidden border border-slate-700/30 flex">
          <!-- Success (green) -->
          <div
            class="h-full transition-all rounded-l-lg"
            style="width: {runtime.uptime}%; background-color: {runtime.color};"
          >
            {#if runtime.uptime > 50}
              <div class="h-full flex items-center justify-end pr-2">
                <span class="text-xs font-bold text-slate-950">{runtime.uptime.toFixed(1)}%</span>
              </div>
            {/if}
          </div>
          
          <!-- Error (red) -->
          <div
            class="h-full transition-all rounded-r-lg"
            style="width: {runtime.errorRate}%; background-color: rgba(239, 68, 68, 0.5);"
          />
        </div>
      </div>
    {/each}
  </div>

  <!-- Legend -->
  <div class="grid grid-cols-2 gap-4 p-4 bg-slate-800/20 rounded-lg border border-slate-700/30">
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <div class="w-6 h-4 rounded bg-gradient-to-r from-emerald-500 to-emerald-600" />
        <span class="text-xs font-medium text-slate-300">Successful Requests</span>
      </div>
      <p class="text-xs text-slate-500">Transactions that completed without error</p>
    </div>
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <div class="w-6 h-4 rounded bg-red-500/50" />
        <span class="text-xs font-medium text-slate-300">Error Rate</span>
      </div>
      <p class="text-xs text-slate-500">Failed requests or timeouts</p>
    </div>
  </div>

  <p class="text-xs text-slate-400">
    <strong>Higher uptime is better.</strong> Even small differences matter at scale — 0.1% error rate means 1 failure per 1,000 requests.
  </p>
</div>
