<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';

	let progress = 0;
	
	$: if (progress < 100) {
		setTimeout(() => progress += Math.random() * 20, 200 + Math.random() * 300);
	}
</script>

{#if $dashboard.isWarmingUp}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
		<div class="bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-700 max-w-md w-full mx-4">
			<h2 class="text-2xl font-bold mb-2 text-center">Waking Up Cluster</h2>
			<p class="text-slate-400 text-center mb-6">Initializing backends and database...</p>
			
			<div class="mb-6">
				<div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
					<div 
						class="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
						style="width: {progress}%"
					></div>
				</div>
				<p class="text-sm text-slate-400 mt-2 text-center">{Math.min(100, Math.floor(progress))}%</p>
			</div>
			
			<div class="mb-4">
				<p class="text-xs text-slate-400 mb-3 uppercase tracking-wide">Checking runtimes:</p>
				<div class="space-y-2">
					{#each $dashboard.runtimes as runtime}
						<div class="flex items-center gap-2">
							<div 
								class="w-2 h-2 rounded-full transition-all duration-300"
								style="background-color: {getRuntimeColor(runtime.id)}; opacity: {progress >= 50 ? 1 : 0.3}"
							></div>
							<span class="text-xs text-slate-400">{runtime.name}</span>
							{#if progress >= 50}
								<span class="ml-auto text-xs text-green-400">✓</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			
			<div class="text-center">
				<p class="text-xs text-slate-500 animate-pulse">This usually takes 10-20 seconds...</p>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.animate-pulse) {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
