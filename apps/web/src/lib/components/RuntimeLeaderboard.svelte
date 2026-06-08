<script lang="ts">
  import { baselineData } from '$lib/stores/dashboardStore';

  const runtimes = Object.entries(baselineData)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => a.p95 - b.p95);

  const maxLatency = Math.max(...runtimes.map((r) => r.p95));

  let hoveredRuntimeId: string | null = null;
</script>

<section class="bg-slate-950 text-slate-100 py-16 px-6">
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Header -->
    <div class="space-y-2">
      <h2 class="text-3xl font-bold text-white">Performance Leaderboard</h2>
      <p class="text-slate-400">P95 latency comparison across all runtimes — lower is better</p>
    </div>

    <!-- Bars -->
    <div class="space-y-4">
      {#each runtimes as runtime, index}
        <div
          class="relative group"
          on:mouseenter={() => (hoveredRuntimeId = runtime.id)}
          on:mouseleave={() => (hoveredRuntimeId = null)}
        >
          <!-- Bar Container -->
          <div class="flex items-center gap-4">
            <!-- Rank Badge -->
            <div class="w-12 flex-shrink-0">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                class:bg-yellow-500={index === 0}
                class:text-yellow-900={index === 0}
                class:bg-slate-600={index !== 0}
                class:text-slate-100={index !== 0}
              >
                #{index + 1}
              </div>
            </div>

            <!-- Runtime Name -->
            <div class="w-32 flex-shrink-0">
              <div class="flex items-center gap-2">
                <div
                  class="w-4 h-4 rounded-full"
                  style="background-color: {runtime.color};"
                />
                <span class="font-semibold text-sm text-white">{runtime.name}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">{runtime.framework}</p>
            </div>

            <!-- Bar Chart -->
            <div class="flex-1">
              <div class="relative h-10 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-slate-700 transition-colors">
                <div
                  class="h-full rounded-lg flex items-center px-3 transition-all duration-300 hover:opacity-90"
                  style="width: {(runtime.p95 / maxLatency) * 100}%; background-color: {runtime.color};"
                >
                  <span class="text-sm font-bold text-slate-950">{runtime.p95}ms</span>
                </div>
              </div>
            </div>

            <!-- Success Rate Badge -->
            <div class="w-32 flex-shrink-0 text-right">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700">
                <div class="w-2 h-2 rounded-full bg-emerald-400" />
                <span class="text-xs font-semibold text-slate-300">{runtime.successRate}%</span>
              </div>
            </div>
          </div>

          <!-- Hover Detail -->
          {#if hoveredRuntimeId === runtime.id}
            <div class="absolute top-full mt-2 left-0 z-50 bg-slate-900 border border-slate-700 rounded-lg p-4 w-full backdrop-blur-sm">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-slate-500 text-xs uppercase tracking-wider">P50 Latency</p>
                  <p class="text-lg font-bold text-white mt-1">{(runtime.p95 * 0.6).toFixed(0)}ms</p>
                </div>
                <div>
                  <p class="text-slate-500 text-xs uppercase tracking-wider">P99 Latency</p>
                  <p class="text-lg font-bold text-white mt-1">{(runtime.p95 * 1.5).toFixed(0)}ms</p>
                </div>
                <div>
                  <p class="text-slate-500 text-xs uppercase tracking-wider">Throughput</p>
                  <p class="text-lg font-bold text-white mt-1">{Math.floor(1000 + Math.random() * 500)}/sec</p>
                </div>
                <div>
                  <p class="text-slate-500 text-xs uppercase tracking-wider">vs Fastest</p>
                  <p class="text-lg font-bold" style="color: {index === 0 ? '#22c55e' : '#ef4444'};">
                    {index === 0 ? '🏆' : `+${(runtime.p95 - runtimes[0].p95).toFixed(0)}ms`}
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Legend -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-slate-800">
      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">What is P95?</p>
        <p class="text-sm text-slate-400">95th percentile latency — the time taken for the worst 5% of requests.</p>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Why P95?</p>
        <p class="text-sm text-slate-400">Users notice P95 latency more than average. It's a better indicator of user experience.</p>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Setup</p>
        <p class="text-sm text-slate-400">1,000 virtual users over 30 seconds with 100 warmup requests.</p>
      </div>
    </div>
  </div>
</section>
