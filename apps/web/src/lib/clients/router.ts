export async function fetchMetrics(): Promise<string> {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    return generateMockPrometheus();
  }
}

function generateMockPrometheus(): string {
  const r = () => (Math.random() * 100).toFixed(2);
  return `
    go_cpu_seconds_total{job="go"} ${r()}
    go_memory_bytes{job="go"} ${r()}
    node_cpu_seconds_total{job="node"} ${r()}
    node_memory_bytes{job="node"} ${r()}
    rust_cpu_seconds_total{job="rust"} ${r()}
    rust_memory_bytes{job="rust"} ${r()}
    bun_cpu_seconds_total{job="bun"} ${r()}
    bun_memory_bytes{job="bun"} ${r()}
    python_cpu_seconds_total{job="python"} ${r()}
    python_memory_bytes{job="python"} ${r()}
    php_cpu_seconds_total{job="php"} ${r()}
    php_memory_bytes{job="php"} ${r()}
  `.trim();
}