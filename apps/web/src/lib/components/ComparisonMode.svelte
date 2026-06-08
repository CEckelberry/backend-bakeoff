<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	import type { Runtime } from '$lib/config';
	
	$: selected = $dashboard.selectedRuntime;
	$: comparisonRuntimes = $dashboard.runtimes.filter(r => r.id !== selected);
	
	const getComparisonData = (runtime: Runtime) => {
		// Simulated comparison data
		const baseLatency = 100;
		const variance = Math.random() * 40;
		return {
			latency: baseLatency + variance,
			memory: Math.floor(Math.random() * 50) + 20,
			cpu: Math.floor(Math.random() * 30) + 10
		};
	};
</script>

<div class="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
	<h2 class="text-xl font-bold mb-4">Comparison Mode</h2>
	
	<div class="space-y-4">
		{#each comparisonRuntimes as runtime}
			<div class="p-4 bg-slate-800 rounded-lg border border-slate-700">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full" style="background-color: {getRuntimeColor(runtime.id)}"></div>
						<span class="font-medium">{runtime.name}</span>
					</div>
					<span class="text-sm text-slate-400">vs {selected}</span>
				</div>
				
				<div class="grid grid-cols-3 gap-4 text-center">
					<div>
						<div class="text-xs text-slate-500">Latency</div>
						<div class="font-mono text-lg">{getComparisonData(runtime).latency.toFixed(1)}ms</div>
					</div>
					<div>
						<div class="text-xs text-slate-500">Memory</div>
						<div class="font-mono text-lg">{getComparisonData(runtime).memory}MB</div>
					</div>
					<div>
						<div class="text-xs text-slate-500">CPU</div>
						<div class="font-mono text-lg">{getComparisonData(runtime).cpu}%</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>