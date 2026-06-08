<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	import type { TimingData } from '$lib/config';
	
	$: selected = $dashboard.selectedRuntime;
	
	const getTimingData = (): TimingData[] => {
		return [
			{ label: 'DNS Lookup', value: Math.floor(Math.random() * 5) + 1 },
			{ label: 'TCP Connect', value: Math.floor(Math.random() * 10) + 2 },
			{ label: 'TLS Handshake', value: Math.floor(Math.random() * 20) + 5 },
			{ label: 'Server Processing', value: Math.floor(Math.random() * 50) + 10 },
			{ label: 'Content Download', value: Math.floor(Math.random() * 30) + 5 }
		];
	};
	
	$: timingData = getTimingData();
	$: totalTime = timingData.reduce((sum, t) => sum + t.value, 0);
</script>

<div class="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
	<h2 class="text-xl font-bold mb-4">Timing Breakdown</h2>
	
	<div class="space-y-3">
		{#each timingData as timing}
			<div>
				<div class="flex justify-between text-sm mb-1">
					<span class="text-slate-400">{timing.label}</span>
					<span class="font-mono">{timing.value}ms</span>
				</div>
				<div class="h-2 bg-slate-800 rounded-full overflow-hidden">
					<div 
						class="h-full rounded-full transition-all duration-500 ease-out"
						style="width: {(timing.value / totalTime) * 100}%; background-color: {getRuntimeColor(selected)}"
					></div>
				</div>
			</div>
		{/each}
	</div>
	
	<div class="mt-6 pt-4 border-t border-slate-800">
		<div class="flex justify-between items-center">
			<span class="text-slate-400">Total Time</span>
			<span class="font-mono text-xl font-bold">{totalTime}ms</span>
		</div>
	</div>
</div>