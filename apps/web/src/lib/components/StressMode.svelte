<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	
	let rps = 50;
	let duration = 15;
	let isRunning = false;
	let results: { rps: number; success: number; fail: number; avgMs: number } | null = null;
	
	const runStressTest = async () => {
		isRunning = true;
		results = null;
		
		// Simulate stress test
		await new Promise(resolve => setTimeout(resolve, duration * 1000));
		
		results = {
			rps,
			success: Math.floor(rps * duration * 0.99),
			fail: Math.ceil(rps * duration * 0.01),
			avgMs: Math.floor(Math.random() * 20) + 5
		};
		
		isRunning = false;
	};
</script>

<div class="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
	<h2 class="text-xl font-bold mb-4">Stress Test</h2>
	
	<div class="space-y-4">
		<div class="grid grid-cols-2 gap-4 mb-6">
			<div>
				<label class="block text-sm text-slate-400 mb-2" for="rps-slider">Requests/sec: {rps}</label>
				<input 
					id="rps-slider"
					type="range" 
					min="1" 
					max="200" 
					bind:value={rps}
					disabled={isRunning}
					class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
				/>
			</div>
			
			<div>
				<label class="block text-sm text-slate-400 mb-2" for="duration-slider">Duration: {duration}s</label>
				<input 
					id="duration-slider"
					type="range" 
					min="10" 
					max="30" 
					bind:value={duration}
					disabled={isRunning}
					class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
				/>
			</div>
		</div>
		
		<button 
			on:click={runStressTest}
			disabled={isRunning}
			class="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200"
		>
			{isRunning ? 'Testing...' : 'Start Stress Test'}
		</button>
		
		{#if results}
			<div class="mt-4 space-y-2 p-4 bg-slate-800 rounded-lg border border-slate-700">
				<div class="flex justify-between">
					<span class="text-slate-400">Requests:</span>
					<span class="font-mono text-green-400">{results.success + results.fail}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-400">Success:</span>
					<span class="font-mono text-green-400">{results.success}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-slate-400">Failed:</span>
					<span class="font-mono text-red-400">{results.fail}</span>
				</div>
				<div class="flex justify-between pt-2 border-t border-slate-600">
					<span class="text-slate-400">Avg Latency:</span>
					<span class="font-mono text-blue-400">{results.avgMs}ms</span>
				</div>
			</div>
		{/if}
	</div>
</div>
