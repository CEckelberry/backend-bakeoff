<script lang="ts">
  export let title: string;
  export let subtitle: string = '';
  export let unit: string = '';
  export let series: Array<{
    id: string;
    name: string;
    color: string;
    points: Array<{ timestamp: number; value: number }>;
  }> = [];
  export let yFormatter: (v: number) => string = (v) => `${v.toFixed(1)}${unit}`;

  const W = 800;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 32, left: 52 };

  $: allValues = series.flatMap((s) => s.points.map((p) => p.value)).filter(isFinite);
  $: allTimestamps = series.flatMap((s) => s.points.map((p) => p.timestamp));

  $: minT = allTimestamps.length ? Math.min(...allTimestamps) : 0;
  $: maxT = allTimestamps.length ? Math.max(...allTimestamps) : 1;
  $: minV = 0;
  $: maxV = allValues.length ? Math.max(...allValues) * 1.1 : 1;

  function xScale(t: number): number {
    if (maxT === minT) return PAD.left;
    return PAD.left + ((t - minT) / (maxT - minT)) * (W - PAD.left - PAD.right);
  }

  function yScale(v: number): number {
    if (maxV === minV) return H - PAD.bottom;
    return H - PAD.bottom - ((v - minV) / (maxV - minV)) * (H - PAD.top - PAD.bottom);
  }

  function toPath(points: Array<{ timestamp: number; value: number }>): string {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.timestamp).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(' ');
  }

  $: yTicks = maxV > 0
    ? [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV].map((v) => ({ v, y: yScale(v) }))
    : [];

  $: noData = allValues.length === 0;
</script>

<div class="space-y-3">
  <div class="space-y-1">
    <h4 class="text-base font-semibold text-white">{title}</h4>
    {#if subtitle}<p class="text-xs text-slate-400">{subtitle}</p>{/if}
  </div>

  <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
    {#if noData}
      <div class="flex items-center justify-center h-40 text-slate-500 text-sm">
        No data — backends may still be warming up
      </div>
    {:else}
      <svg viewBox="0 0 {W} {H}" class="w-full h-auto">
        <!-- Y-axis grid + labels -->
        {#each yTicks as tick}
          <line
            x1={PAD.left} y1={tick.y}
            x2={W - PAD.right} y2={tick.y}
            stroke="#334155" stroke-width="1"
          />
          <text
            x={PAD.left - 6} y={tick.y + 4}
            font-size="11" fill="#64748b" text-anchor="end"
          >{yFormatter(tick.v)}</text>
        {/each}

        <!-- Lines per runtime -->
        {#each series as s}
          {#if s.points.length > 1}
            <path
              d={toPath(s.points)}
              stroke={s.color}
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/if}
        {/each}
      </svg>
    {/if}

    <!-- Legend -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {#each series as s}
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-0.5 rounded" style="background-color: {s.color};" />
          <span class="text-xs text-slate-400">{s.name}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
