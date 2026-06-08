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

// Baseline data for all runtimes
export const baselineData: Record<string, { name: string; framework: string; p95: number; successRate: number; color: string }> = {
  rust: { name: 'Rust', framework: 'Axum', p95: 18, successRate: 99.95, color: '#FAC775' },
  go: { name: 'Go', framework: 'Fiber v2', p95: 42, successRate: 99.7, color: '#5DCAA5' },
  bun: { name: 'Bun', framework: 'Hono', p95: 56, successRate: 98.5, color: '#F4C0D1' },
  node: { name: 'Node', framework: 'Fastify', p95: 65, successRate: 97.8, color: '#AFA9EC' },
  python: { name: 'Python', framework: 'FastAPI', p95: 72, successRate: 98.2, color: '#ED93B1' },
  php: { name: 'PHP', framework: 'Laravel', p95: 85, successRate: 97.5, color: '#7F77DD' },
};

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

      for (const runtime of runtimes) {
        update((state) => ({
          ...state,
          currentTestRuntime: runtime,
        }));

        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const baseline = baselineData[runtime];
          const mockResult: TestResult = {
            runtime,
            p95: baseline.p95 + Math.random() * 10 - 5,
            p50: baseline.p95 * 0.6 + Math.random() * 5,
            successRate: baseline.successRate + (Math.random() * 0.2 - 0.1),
            throughput: Math.floor(1000 + Math.random() * 500),
            breakdown: {
              db: baseline.p95 * 0.5,
              logic: baseline.p95 * 0.3,
              network: baseline.p95 * 0.2,
            },
            timestamp: new Date().toISOString(),
          };

          update((state) => ({
            ...state,
            testResults: {
              ...state.testResults,
              [runtime]: mockResult,
            },
          }));
        } catch (error) {
          console.error(`Test for ${runtime} failed:`, error);
        }
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
