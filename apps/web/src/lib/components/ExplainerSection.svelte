<script lang="ts">
  interface WorkflowStep {
    title: string;
    description: string;
    icon: string;
  }

  const steps: WorkflowStep[] = [
    {
      title: 'Auth Check',
      description: 'Validate JWT session',
      icon: '🔐',
    },
    {
      title: 'Inventory Lock',
      description: 'Atomic DB update',
      icon: '📦',
    },
    {
      title: 'Payment Gateway',
      description: 'HTTPS to payment processor',
      icon: '💳',
    },
    {
      title: 'Order Creation',
      description: 'Write to database',
      icon: '📝',
    },
    {
      title: 'Notification',
      description: 'Trigger async events',
      icon: '📧',
    },
  ];
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-5xl mx-auto space-y-12">
    <!-- Heading -->
    <div class="space-y-4">
      <h2 class="text-3xl md:text-4xl font-bold text-white">What Is This Benchmark?</h2>
      <p class="text-slate-400 text-lg max-w-3xl">
        Most benchmarks test hello-world endpoints or simple JSON serialization. This one is different.
      </p>
    </div>

    <!-- Main explanation -->
    <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 space-y-4">
      <p class="text-slate-300 leading-relaxed">
        We simulate a <strong>real-world checkout transaction</strong> — the kind that generates revenue for online businesses. Each test measures how each runtime handles:
      </p>
      <ul class="space-y-3 text-slate-300">
        <li class="flex items-start gap-3">
          <span class="text-emerald-400 font-bold mt-1">→</span>
          <span><strong>Throughput:</strong> How many successful checkouts per second under load</span>
        </li>
        <li class="flex items-start gap-3">
          <span class="text-emerald-400 font-bold mt-1">→</span>
          <span><strong>Latency:</strong> P50, P95, P99 response times across a 30-second ramp-up</span>
        </li>
        <li class="flex items-start gap-3">
          <span class="text-emerald-400 font-bold mt-1">→</span>
          <span><strong>Resource Efficiency:</strong> Memory, CPU, and database connection usage</span>
        </li>
        <li class="flex items-start gap-3">
          <span class="text-emerald-400 font-bold mt-1">→</span>
          <span><strong>Error Handling:</strong> Reliability under extreme load</span>
        </li>
      </ul>
    </div>

    <!-- Workflow steps -->
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white">The Checkout Workflow</h3>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        {#each steps as step, index}
          <div class="relative flex flex-col items-center">
            <!-- Card -->
            <div class="w-full h-full bg-slate-900/50 rounded-xl border border-slate-800 p-6 text-center space-y-3 hover:border-slate-700 transition-colors flex flex-col items-center justify-start">
              <div class="text-4xl flex-shrink-0">{step.icon}</div>
              <h4 class="font-semibold text-white text-sm">{step.title}</h4>
              <p class="text-sm text-slate-400 flex-grow">{step.description}</p>
            </div>

            <!-- Arrow connecting to next step -->
            {#if index < steps.length - 1}
              <div class="hidden md:flex absolute -right-2 top-20">
                <svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Key metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
        <div class="text-2xl font-bold text-emerald-400">1,000</div>
        <div class="text-xs text-slate-400 mt-1">Virtual Users</div>
      </div>
      <div class="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
        <div class="text-2xl font-bold text-emerald-400">30s</div>
        <div class="text-xs text-slate-400 mt-1">Ramp-up Time</div>
      </div>
      <div class="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
        <div class="text-2xl font-bold text-emerald-400">100</div>
        <div class="text-xs text-slate-400 mt-1">Warmup Requests</div>
      </div>
      <div class="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
        <div class="text-2xl font-bold text-emerald-400">Same</div>
        <div class="text-xs text-slate-400 mt-1">Hardware</div>
      </div>
    </div>
  </div>
</section>
