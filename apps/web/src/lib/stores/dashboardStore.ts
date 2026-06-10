import { writable } from 'svelte/store';

export interface TestResult {
  runtime: string;
  p95: number;
  p50: number;
  successRate: number;
  throughput: number;
  breakdown: {
    db: number;
    logic: number;
    network: number;
  };
  timestamp: string;
}

export interface DashboardState {
  selectedRuntimes: string[];
  isRunning: boolean;
  testResults: Record<string, TestResult>;
  currentTestRuntime: string | null;
  comparisonRuntime: string | null;
  isComparing: boolean;
  showMethodology: boolean;
}

// Baseline data — sourced from seed SQL (2026-05-17 baseline run, checkout_single p95)
export const baselineData: Record<string, { name: string; framework: string; p95: number; successRate: number; throughput: number; color: string }> = {
  rust:   { name: 'Rust',   framework: 'Axum',     p95: 16.01,  successRate: 100.0,  throughput: 1480, color: '#FAC775' },
  go:     { name: 'Go',     framework: 'Fiber v2', p95: 12.45,  successRate: 99.99,  throughput: 1210, color: '#5DCAA5' },
  rails:  { name: 'Rails',  framework: 'Puma',     p95: 20.12,  successRate: 100.0,  throughput:  820, color: '#EF4444' },
  node:   { name: 'Node',   framework: 'Fastify',  p95: 17.16,  successRate: 100.0,  throughput: 1090, color: '#AFA9EC' },
  python: { name: 'Python', framework: 'FastAPI',  p95: 31.52,  successRate: 99.99,  throughput:  690, color: '#ED93B1' },
  php:    { name: 'PHP',    framework: 'Swoole',   p95: 144.86, successRate: 100.0,  throughput:  340, color: '#7F77DD' },
};

// ─── Load test constants ────────────────────────────────────────────────────
const BENCH_REQUESTS = 500;
const BENCH_CONCURRENCY = 25;
// Fixed test customer — doesn't need to exist in the customers table
const TEST_CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';

async function fetchProductIds(runtime: string): Promise<string[]> {
  try {
    const res = await fetch('/api/router?path=/products', {
      headers: { 'X-Runtime': runtime },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.products ?? []) as Array<{ id: string }>).map((p) => p.id);
  } catch {
    return [];
  }
}

function buildCheckoutBody(productIds: string[]): string {
  return JSON.stringify({
    customer_id: TEST_CUSTOMER_ID,
    items: [{ product_id: productIds[Math.floor(Math.random() * productIds.length)], quantity: 1 }],
    state: 'CA',
  });
}

function calcPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function runLoadTest(
  runtime: string,
  productIds: string[]
): Promise<{ p50: number; p95: number; successRate: number; throughput: number }> {
  const timings: number[] = [];
  let failures = 0;
  const wallStart = performance.now();

  for (let i = 0; i < BENCH_REQUESTS; i += BENCH_CONCURRENCY) {
    const batchSize = Math.min(BENCH_CONCURRENCY, BENCH_REQUESTS - i);
    await Promise.all(
      Array.from({ length: batchSize }, async () => {
        const t0 = performance.now();
        try {
          const res = await fetch('/api/router', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Runtime': runtime },
            body: buildCheckoutBody(productIds),
          });
          if (!res.ok) failures++;
        } catch {
          failures++;
        }
        timings.push(performance.now() - t0);
      })
    );
  }

  const wallMs = performance.now() - wallStart;
  const sorted = timings.slice().sort((a, b) => a - b);

  return {
    p50: calcPercentile(sorted, 50),
    p95: calcPercentile(sorted, 95),
    successRate: ((timings.length - failures) / timings.length) * 100,
    throughput: Math.round((BENCH_REQUESTS / wallMs) * 1000),
  };
}
// ────────────────────────────────────────────────────────────────────────────

function createDashboardStore() {
  const { subscribe, set, update } = writable<DashboardState>({
    selectedRuntimes: [],
    isRunning: false,
    testResults: {},
    currentTestRuntime: null,
    comparisonRuntime: null,
    isComparing: false,
    showMethodology: false,
  });

  return {
    subscribe,

    toggleRuntime: (runtime: string) => {
      update((state) => {
        const isSelected = state.selectedRuntimes.includes(runtime);
        return {
          ...state,
          selectedRuntimes: isSelected
            ? state.selectedRuntimes.filter((r) => r !== runtime)
            : [...state.selectedRuntimes, runtime],
        };
      });
    },

    clearSelection: () => {
      update((state) => ({
        ...state,
        selectedRuntimes: [],
      }));
    },

    runMultipleTests: async (runtimes: string[]) => {
      update((state) => ({
        ...state,
        isRunning: true,
        testResults: {},
        currentTestRuntime: runtimes[0] || null,
      }));

      const gathered: Record<string, TestResult> = {};

      for (const runtime of runtimes) {
        update((state) => ({ ...state, currentTestRuntime: runtime }));

        try {
          // Fetch real product IDs for this runtime
          const productIds = await fetchProductIds(runtime);
          if (productIds.length === 0) {
            console.error(`No products returned for ${runtime} — skipping`);
            continue;
          }

          // Run real load test: BENCH_REQUESTS checkout requests at BENCH_CONCURRENCY concurrency
          const { p50, p95, successRate, throughput } = await runLoadTest(runtime, productIds);

          const result: TestResult = {
            runtime,
            p50,
            p95,
            successRate,
            throughput,
            breakdown: {
              db: p95 * 0.5,
              logic: p95 * 0.3,
              network: p95 * 0.2,
            },
            timestamp: new Date().toISOString(),
          };

          gathered[runtime] = result;
          update((state) => ({
            ...state,
            testResults: { ...state.testResults, [runtime]: result },
          }));
        } catch (error) {
          console.error(`Benchmark for ${runtime} failed:`, error);
        }
      }

      // Persist real results to results-api
      try {
        const apiResults: Record<string, { p50: number; p95: number; successRate: number; throughput: number }> = {};
        for (const [runtime, r] of Object.entries(gathered)) {
          apiResults[runtime] = { p50: r.p50, p95: r.p95, successRate: r.successRate, throughput: r.throughput };
        }
        await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'web-ui run', results: apiResults }),
        });
      } catch (err) {
        console.error('Failed to save results to API:', err);
      }

      update((state) => ({
        ...state,
        isRunning: false,
        currentTestRuntime: null,
      }));
    },

    benchmarkAgain: () => {
      update((state) => ({
        ...state,
        testResults: {},
        currentTestRuntime: null,
        selectedRuntimes: [],
      }));
    },

    setComparison: (runtime: string) => {
      update((state) => ({
        ...state,
        comparisonRuntime: runtime,
        isComparing: true,
      }));
    },

    clearComparison: () => {
      update((state) => ({
        ...state,
        comparisonRuntime: null,
        isComparing: false,
      }));
    },

    toggleMethodology: () => {
      update((state) => ({
        ...state,
        showMethodology: !state.showMethodology,
      }));
    },

    closeMethodology: () => {
      update((state) => ({
        ...state,
        showMethodology: false,
      }));
    },

    reset: () => {
      set({
        selectedRuntimes: [],
        isRunning: false,
        testResults: {},
        currentTestRuntime: null,
        comparisonRuntime: null,
        isComparing: false,
        showMethodology: false,
      });
    },
  };
}

export const dashboardStore = createDashboardStore();

export const activeTab = writable<'overview' | 'test' | 'monitoring'>('overview');
export const activeGraph = writable<'throughput' | 'latency' | 'resources' | 'reliability'>('throughput');
