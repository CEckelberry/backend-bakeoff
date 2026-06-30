<script lang="ts">
	import '../app.css';
	import type { LayoutLoad } from './$types';
	import { initDashboard } from '$lib/stores/dashboard';
	import { initAmplitude } from '$lib/utils/analytics';
	import { onMount } from 'svelte';

	export const data = undefined;

	onMount(() => {
		initDashboard();
		initAmplitude();
	});
</script>

<slot />