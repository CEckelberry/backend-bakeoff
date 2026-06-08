<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	import type { Runtime } from '$lib/config';
	
	$: selected = $dashboard.selectedRuntime;
	
	const selectRuntime = (runtime: Runtime) => {
		$dashboard.selectedRuntime = runtime.id;
	};
</script>

<div class="bg-slate-900 rounded-xl p-2 border border-slate-800 shadow-lg">
	<div class="flex flex-wrap gap-2">
		{#each $dashboard.runtimes as runtime}
			<button
				on:click={() => selectRuntime(runtime)}
				class="flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ease-spring flex items-center justify-center gap-2"
				class:bg-slate-800={selected !== runtime.id}
				class:bg-slate-700={selected === runtime.id}
				class:text-slate-400={selected !== runtime.id}
				class:text-white={selected === runtime.id}
				style="border: 1px solid {selected === runtime.id ? getRuntimeColor(runtime.id) : 'transparent'}"
			>
				<div class="w-2 h-2 rounded-full" style="background-color: {getRuntimeColor(runtime.id)}"></div>
				{runtime.name} <span class="text-slate-400 font-normal opacity-75">({runtime.framework})</span>
			</button>
		{/each}
	</div>
</div>