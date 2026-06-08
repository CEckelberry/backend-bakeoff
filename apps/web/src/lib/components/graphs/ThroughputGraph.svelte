<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';
  import { lastRunStore, showLastRun } from '$lib/stores/lastRunStore';
  import { liveMetricsStore } from '$lib/stores/liveMetricsStore';

  $: live = $liveMetricsStore.data;

  $: runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({
      id,
      ...data,
      throughput: live?.[id]?.throughput ?? data.throughput,
      isLive: live?.[id]?.isLive ?? false,
    }))
    .sort((a, b) => b.throughput - a.throughput);

  $: lastRun = $lastRunStore.data;
  $: maxThroughput = Math.max(
    ...runtimes.map((r) => r.throughput),
    ...(lastRun && $showLastRun ? Object.values(lastRun).map((v) => v.throughput) : [0])
  );
</script>

<div class="space-y-8">
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Throughput</h3>
    <p class="text-sm text-slate-400">Requests per second under load</p>
  </div>

  <div class="space-y-6">
    {#each runtimes as runtime}
      {@const lastRunVal = lastRun?.[runtime.id]}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {runtime.color};" />
            <span class="font-medium text-sm text-white">
              {runtime.name} <span class="text-slate-400 font-normal">({runtime.framework})</span>
            </span>
          </div>
          <div class="flex items-center gap-3">
            {#if $showLastRun && lastRunVal}
              <span class="text-xs text-slate-400">
                Last: <span class="font-bold" style="color: {runtime.color};">{lastRunVal.throughput} rps</span>
              </span>
            {/if}
            <span class="font-bold text-lg" style="color: {runtime.color};">{runtime.throughput} rps</span>
          </div>
        </div>

        <!-- Baseline bar -->
        <div class="h-8 bg-slate-800/50 rounded-lg overflow-hidden relative">
          <div
            class="h-full rounded-lg transition-all duration-500 flex items-center px-3"
            style="width: {(runtime.throughput / maxThroughput) * 100}%; background-color: {runtime.color};"
          >
            <span class="text-xs font-bold text-white/80">baseline</span>
          </div>
          <!-- Last run marker -->
          {#if $showLastRun && lastRunVal}
            <div
              class="absolute top-1 bottom-1 w-0.5 bg-white/70"
              style="left: {(lastRunVal.throughput / maxThroughput) * 100}%;"
            />
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
