import { writable } from 'svelte/store';
import type { RuntimeSnapshot } from '../../routes/api/snapshot/+server';

interface LiveMetricsState {
  data: Record<string, RuntimeSnapshot> | null;
  loading: boolean;
  error: string | null;
}

function createLiveMetricsStore() {
  const { subscribe, set, update } = writable<LiveMetricsState>({
    data: null,
    loading: false,
    error: null,
  });

  return {
    subscribe,
    fetch: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch('/api/snapshot');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Record<string, RuntimeSnapshot> = await res.json();
        set({ data, loading: false, error: null });
      } catch (err) {
        update((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
  };
}

export const liveMetricsStore = createLiveMetricsStore();
