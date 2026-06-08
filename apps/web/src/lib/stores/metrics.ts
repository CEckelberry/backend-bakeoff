import { writable } from 'svelte/store';

export interface RuntimeMetrics {
  [key: string]: {
    cpu: number[];
    memory: number[];
    latency: number[];
    orders: number[];
  };
}

export const metrics = writable<RuntimeMetrics>({
  node: { cpu: [], memory: [], latency: [], orders: [] },
  go: { cpu: [], memory: [], latency: [], orders: [] },
  rust: { cpu: [], memory: [], latency: [], orders: [] },
  rails: { cpu: [], memory: [], latency: [], orders: [] },
  python: { cpu: [], memory: [], latency: [], orders: [] },
  php: { cpu: [], memory: [], latency: [], orders: [] }
});

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startMetricsPolling() {
  if (intervalId) return;
  intervalId = setInterval(async () => {
    try {
      // Simulate metrics polling
      metrics.update(m => {
        Object.keys(m).forEach(key => {
          const data = m[key];
          data.latency.push(Math.random() * 20 + 5);
          if (data.latency.length > 60) data.latency.shift();
        });
        return m;
      });
    } catch (err) {
      console.error('Metrics polling failed:', err);
    }
  }, 2000);
}

export function stopMetricsPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
