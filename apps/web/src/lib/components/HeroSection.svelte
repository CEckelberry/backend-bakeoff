<script lang="ts">
  function scrollToTests() {
    if (typeof window !== 'undefined') {
      const target = document.getElementById('runtime-cards');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
</script>

<section class="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 py-8 md:py-12 px-6 overflow-hidden">
  <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950 pointer-events-none" />

  <div class="relative max-w-4xl mx-auto text-center space-y-6">
    <h1 class="text-4xl sm:text-5xl md:text-5xl font-bold tracking-tight text-white leading-tight">
      The Backend Runtime <span class="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Showdown</span>
    </h1>

    <p class="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
      See how Go, Rust, Bun, Node, Python, and PHP handle real-world checkout transactions under load.
    </p>

    <p class="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
      Forget synthetic micro-benchmarks and hello-world scripts. This is a <strong>production-grade stress test</strong> measuring throughput, latency, and resource efficiency across actual e-commerce workflows.
    </p>


  </div>
</section>
