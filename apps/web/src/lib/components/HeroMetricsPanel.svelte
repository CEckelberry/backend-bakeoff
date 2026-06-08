<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	
	$: selected = $dashboard.selectedRuntime;
	$: runtime = $dashboard.runtimes.find(r => r.id === selected);
	
	// Generate mock data for the chart
	const chartData = Array.from({ length: 20 }, () => Math.random() * 100);
	const maxValue = Math.max(...chartData, 100);
	
	// Create SVG path for the line chart
	const width = 400;
	const height = 200;
	const padding = 40;
	const pointSpacing = (width - 2 * padding) / (chartData.length - 1);
	
	let pathD = '';
	chartData.forEach((value, i) => {
		const x = padding + i * pointSpacing;
		const y = height - padding - (value / maxValue) * (height - 2 * padding);
		pathD += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
	});
</script>

<div class="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold">p95 Latency Distribution</h2>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded-full" style="background-color: {getRuntimeColor(selected)}"></div>
			<span class="text-sm text-slate-400">{runtime?.name}</span>
		</div>
	</div>
	
	<div class="h-64 w-full bg-slate-800/30 rounded-lg p-4 flex items-center justify-center">
		<svg {width} {height} class="w-full h-full" viewBox="0 0 400 200" style="max-width: 100%;">
			<!-- Grid lines -->
			<line x1="40" y1="40" x2="40" y2="160" stroke="#475569" stroke-width="1" />
			<line x1="40" y1="160" x2="400" y2="160" stroke="#475569" stroke-width="1" />
			
			<!-- Grid background -->
			<rect x="40" y="40" width="360" height="120" fill="#1e293b" opacity="0.3" />
			
			<!-- Chart line -->
			<path {pathD} stroke={getRuntimeColor(selected)} stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
			
			<!-- Y-axis labels -->
			<text x="30" y="45" font-size="12" fill="#94a3b8" text-anchor="end">100</text>
			<text x="30" y="105" font-size="12" fill="#94a3b8" text-anchor="end">50</text>
			<text x="30" y="165" font-size="12" fill="#94a3b8" text-anchor="end">0</text>
		</svg>
	</div>
</div>
