<script lang="ts">
	import '../app.css';
	import type { LayoutLoad } from './$types';
	import { initDashboard } from '$lib/stores/dashboard';
	import { onMount } from 'svelte';

	export const data = undefined;

	onMount(() => {
		initDashboard();
	});
</script>

<slot />