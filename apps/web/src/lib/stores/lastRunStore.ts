import { writable } from 'svelte/store';

export interface RuntimeRunResult {
  p50: number;
  p95: number;
  successRate: number;
  throughput: number;
}

interface LastRunState {
  data: Record<string, RuntimeRunResult> | null;
  loading: boolean;
  error: string | null;
  ranAt: string | null;
  label: string | null;
}

function createLastRunStore() {
  const { subscribe, set, update } = writable<LastRunState>({
    data: null,
    loading: false,
    error: null,
    ranAt: null,
    label: null,
  });

  return {
    subscribe,
    fetch: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch('/api/results');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Pick the most recent user run, fall back to baseline
        const runs: Array<{ id: string; run_type: string; label: string | null; ran_at: string; results: Record<string, RuntimeRunResult> }> =
          json.runs ?? [];

        const userRun =
          runs.find((r) => r.run_type === 'user' && r.label !== 'auto-snapshot') ??
          runs[0] ??
          null;

        if (!userRun) {
          set({ data: null, loading: false, error: null, ranAt: null, label: null });
          return;
        }

        set({
          data: userRun.results as Record<string, RuntimeRunResult>,
          loading: false,
          error: null,
          ranAt: userRun.ran_at,
          label: userRun.label,
        });
      } catch (err) {
        update((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    clear: () => set({ data: null, loading: false, error: null, ranAt: null, label: null }),
  };
}

export const lastRunStore = createLastRunStore();
export const showLastRun = writable(false);
