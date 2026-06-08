<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	
	$: status = $dashboard.healthStatus;
</script>

<div class="flex items-center gap-2">
	<div 
		class="w-2 h-2 rounded-full"
		class:bg-green-500={status === 'healthy'}
		class:bg-yellow-500={status === 'degraded'}
		class:bg-red-500={status === 'unhealthy'}
		class:animate-pulse={status !== 'healthy'}
	></div>
	<span class="text-sm text-slate-400 capitalize">{status}</span>
</div>