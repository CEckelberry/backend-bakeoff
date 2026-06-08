<script lang="ts">
	import { dashboard } from '$lib/stores/dashboard';
	import { getRuntimeColor } from '$lib/utils/colors';
	
	let quantity = 1;
	let isProcessing = false;
	let result: { time: number; status: string } | null = null;
	
	$: selected = $dashboard.selectedRuntime;
	$: runtime = $dashboard.runtimes.find(r => r.id === selected);
	
	const placeOrder = async () => {
		isProcessing = true;
		result = null;
		
		// Simulate API call
		await new Promise(resolve => setTimeout(resolve, 1500));
		
		result = {
			time: Math.floor(Math.random() * 50) + 10,
			status: 'success'
		};
		
		isProcessing = false;
	};
</script>

<div class="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
	<h2 class="text-xl font-bold mb-4">Place Order</h2>
	
	<div class="space-y-4">
		<div>
			<label class="block text-sm text-slate-400 mb-2" for="quantity">Quantity</label>
			<input 
				id="quantity"
				type="number" 
				min="1" 
				bind:value={quantity}
				class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		
		<button 
			on:click={placeOrder}
			disabled={isProcessing}
			class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 ease-out flex items-center justify-center gap-2"
		>
			{#if isProcessing}
				<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span>Processing...</span>
			{:else}
				<span>Place Order</span>
			{/if}
		</button>
		
		{#if result}
			<div class="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-green-500 rounded-full"></div>
						<span class="text-green-400 font-medium">Order Complete</span>
					</div>
					<span class="font-mono text-lg">{result.time}ms</span>
				</div>
			</div>
		{/if}
	</div>
</div>
