<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	
	$: error = $dashboard.error;
	
	const dismissError = () => {
		$dashboard.error = null;
	};
</script>

{#if error}
	<div class="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
		<svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		
		<div class="flex-1">
			<h3 class="text-red-400 font-medium mb-1">Benchmark Error</h3>
			<p class="text-red-300 text-sm">{error.message}</p>
		</div>
		
		<button aria-label="Dismiss error" 
			on:click={dismissError}
			class="text-red-400 hover:text-red-300 transition-colors"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</div>
{/if}