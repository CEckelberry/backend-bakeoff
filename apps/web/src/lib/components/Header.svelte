<script lang="ts">
	import HealthIndicator from '$lib/components/HealthIndicator.svelte';
	import MethodologyBadge from '$lib/components/MethodologyBadge.svelte';
</script>

<header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
	<div class="container mx-auto px-4 py-4 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
				<svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold">Backend Bake-off</h1>
				<p class="text-xs text-slate-400">Runtime Performance Comparison</p>
			</div>
		</div>
		
		<div class="flex items-center gap-4">
			<HealthIndicator />
			<MethodologyBadge />
		</div>
	</div>
</header>