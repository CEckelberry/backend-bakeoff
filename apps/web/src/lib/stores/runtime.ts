import { writable } from 'svelte/store';

export const selectedRuntime = writable<string>('go');
