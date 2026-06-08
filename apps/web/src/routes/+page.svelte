<script lang="ts">
  import { activeTab, dashboardStore } from '$lib/stores/dashboardStore';
  import HeroSection from '$lib/components/HeroSection.svelte';
  import ExplainerSection from '$lib/components/ExplainerSection.svelte';
  import GraphsContainer from '$lib/components/GraphsContainer.svelte';
  import RuntimeCards from '$lib/components/RuntimeCards.svelte';
  import ExecutionArea from '$lib/components/ExecutionArea.svelte';
  import ResultsPanel from '$lib/components/ResultsPanel.svelte';
  import MonitoringSection from '$lib/components/MonitoringSection.svelte';
</script>

<div class="min-h-screen bg-slate-950 text-white">
  <!-- Tabs at top -->
  <div class="bg-slate-950 px-6 py-4 border-b border-slate-800">
    <div class="max-w-6xl mx-auto">
      <div class="flex gap-3">
        <button
          on:click={() => activeTab.set('overview')}
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          class:bg-emerald-500={$activeTab === 'overview'}
          class:text-white={$activeTab === 'overview'}
          class:text-slate-400={$activeTab !== 'overview'}
          class:hover:text-slate-300={$activeTab !== 'overview'}
          class:hover:bg-slate-800={$activeTab !== 'overview'}
        >
          <span class="text-lg">📊</span>
          <span>Overview</span>
        </button>
        <button
          on:click={() => activeTab.set('test')}
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          class:bg-emerald-500={$activeTab === 'test'}
          class:text-white={$activeTab === 'test'}
          class:text-slate-400={$activeTab !== 'test'}
          class:hover:text-slate-300={$activeTab !== 'test'}
          class:hover:bg-slate-800={$activeTab !== 'test'}
        >
          <span class="text-lg">🚀</span>
          <span>Run Test</span>
        </button>
        <button
          on:click={() => activeTab.set('monitoring')}
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          class:bg-emerald-500={$activeTab === 'monitoring'}
          class:text-white={$activeTab === 'monitoring'}
          class:text-slate-400={$activeTab !== 'monitoring'}
          class:hover:text-slate-300={$activeTab !== 'monitoring'}
          class:hover:bg-slate-800={$activeTab !== 'monitoring'}
        >
          <span class="text-lg">📟</span>
          <span>Monitoring</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Hero (Always visible) -->
  <HeroSection />
  <!-- Tab 1: Overview -->
  {#if $activeTab === 'overview'}
    <div class="animate-fade-in">
      <GraphsContainer />
      <ExplainerSection />
    </div>
  {/if}

  <!-- Tab 2: Run Test -->
  {#if $activeTab === 'test'}
    <div class="animate-fade-in">
      {#if Object.keys($dashboardStore.testResults).length === 0 && !$dashboardStore.isRunning}
        <!-- Selection & Execution Phase (only show before running) -->
        <section class="bg-slate-950 text-slate-100 py-12 px-6">
          <div class="max-w-6xl mx-auto space-y-8">
            <h2 class="text-2xl font-bold text-white">Select Runtimes to Test</h2>
            <RuntimeCards />
          </div>
        </section>
      {/if}
      
      <!-- Show execution area when running -->
      {#if $dashboardStore.isRunning}
        <ExecutionArea />
      {:else if Object.keys($dashboardStore.testResults).length === 0}
        <!-- Show execution area with ready state before running -->
        <ExecutionArea />
      {/if}
      
      <!-- Show results panel when complete -->
      <ResultsPanel />
    </div>
  {/if}

  <!-- Tab 3: Monitoring -->
  {#if $activeTab === 'monitoring'}
    <div class="animate-fade-in">
      <MonitoringSection />
    </div>
  {/if}

  <!-- Footer -->
  <footer class="bg-slate-950 border-t border-slate-800 py-8 px-6">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <p class="text-sm text-slate-500">Backend Bake-off Dashboard · Compare Go, Rust, Bun, Node, Python, and PHP</p>
      <a 
        href="https://github.com/CEckelberry/backend-bakeoff" 
        class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span>GitHub</span>
      </a>
    </div>
  </footer>
</div>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.animate-fade-in) {
    animation: fadeIn 200ms ease-out;
  }
</style>

