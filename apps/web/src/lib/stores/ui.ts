import { writable } from 'svelte/store';

export type Mode = 'casual' | 'comparison' | 'stress';

export const uiState = writable({
  mode: 'casual' as Mode,
  isLoading: false,
  error: null as string | null
});
