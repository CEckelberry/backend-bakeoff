<script lang="ts">
  import { activeTab } from '$lib/stores/dashboardStore';

  interface Tab {
    id: 'overview' | 'test' | 'monitoring';
    label: string;
    icon: string;
  }

  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'test', label: 'Run Test', icon: '🚀' },
    { id: 'monitoring', label: 'Monitoring', icon: '📿' },
  ];
</script>

<div class="bg-slate-950 px-6 py-4 border-b border-slate-800">
  <div class="max-w-6xl mx-auto">
    <!-- Tab buttons -->
    <div class="flex gap-3">
      {#each tabs as tab}
        <button
          on:click={() => activeTab.set(tab.id)}
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          class:bg-emerald-500={$activeTab === tab.id}
          class:text-white={$activeTab === tab.id}
          class:text-slate-400={$activeTab !== tab.id}
          class:hover:text-slate-300={$activeTab !== tab.id}
          class:hover:bg-slate-800={$activeTab !== tab.id}
        >
          <span class="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<slot />
