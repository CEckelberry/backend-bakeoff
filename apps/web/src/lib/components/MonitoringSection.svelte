<script lang="ts">
  import LiveMetricsGraph from './LiveMetricsGraph.svelte';
</script>

<section class="bg-slate-950 text-slate-100 py-8 px-6">
  <div class="max-w-6xl mx-auto space-y-12">
    <!-- Live Metrics Graph from Prometheus -->
    <div>
      <LiveMetricsGraph />
    </div>
  </div>
</section>
