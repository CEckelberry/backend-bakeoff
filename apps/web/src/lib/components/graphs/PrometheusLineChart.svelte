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

  $: minT = allTimestamps.length ? allTimestamps.reduce((a, b) => Math.min(a, b)) : 0;
  $: maxT = allTimestamps.length ? allTimestamps.reduce((a, b) => Math.max(a, b)) : 1;
  $: minV = 0;
  $: maxV = allValues.length ? allValues.reduce((a, b) => Math.max(a, b)) * 1.1 : 1;

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

  // Hover tooltip
  let svgEl: SVGSVGElement;
  let tooltip: { x: number; y: number; items: Array<{ name: string; color: string; value: string }> } | null = null;

  function onMouseMove(e: MouseEvent) {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;

    if (svgX < PAD.left || svgX > W - PAD.right) { tooltip = null; return; }

    // Find the timestamp closest to cursor x
    const t = minT + ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (maxT - minT);

    const items = series
      .filter((s) => s.points.length > 0)
      .map((s) => {
        const closest = s.points.reduce((a, b) =>
          Math.abs(b.timestamp - t) < Math.abs(a.timestamp - t) ? b : a
        );
        return { name: s.name, color: s.color, value: yFormatter(closest.value) };
      })
      .filter((item) => item.value !== yFormatter(0) || series.some((s) => s.points.length > 0));

    tooltip = { x: e.clientX - rect.left, y: e.clientY - rect.top, items };
  }

  function onMouseLeave() {
    tooltip = null;
  }
</script>

<div class="space-y-3">
  <div class="space-y-1">
    <h4 class="text-base font-semibold text-white">{title}</h4>
    {#if subtitle}<p class="text-xs text-slate-400">{subtitle}</p>{/if}
  </div>

  <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-4 relative">
    {#if noData}
      <div class="flex items-center justify-center h-40 text-slate-500 text-sm">
        No data — backends may still be warming up
      </div>
    {:else}
      <div class="relative">
        <svg
          bind:this={svgEl}
          viewBox="0 0 {W} {H}"
          class="w-full h-auto cursor-crosshair"
          on:mousemove={onMouseMove}
          on:mouseleave={onMouseLeave}
        >
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
              <!-- End-of-line label -->
              {#if s.points.length > 0}
                {@const last = s.points[s.points.length - 1]}
                <text
                  x={xScale(last.timestamp) + 4}
                  y={yScale(last.value) + 4}
                  font-size="10"
                  fill={s.color}
                  font-weight="600"
                >{s.name}</text>
              {/if}
            {/if}
          {/each}
        </svg>

        <!-- Hover tooltip -->
        {#if tooltip}
          <div
            class="absolute pointer-events-none z-10 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg"
            style="left: {Math.min(tooltip.x + 12, 240)}px; top: {tooltip.y - 10}px; transform: {tooltip.x > 180 ? 'translateX(-100%) translateX(-24px)' : 'none'}"
          >
            {#each tooltip.items as item}
              <div class="flex items-center gap-2 py-0.5">
                <div class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {item.color};" />
                <span class="text-slate-300">{item.name}:</span>
                <span class="font-bold text-white">{item.value}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
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
