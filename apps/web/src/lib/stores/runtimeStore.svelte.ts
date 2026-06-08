import { writable } from 'svelte/store';

export interface Runtime {
  id: string;
  name: string;
  framework: string;
  avgLatency: number;
  successRate: number;
  color: string;
}

export const runtimes: Runtime[] = [
  { id: 'go', name: 'Go', framework: 'Fiber', avgLatency: 8.2, successRate: 99.7, color: '#5DCAA5' },
  { id: 'rust', name: 'Rust', framework: 'Actix', avgLatency: 5.4, successRate: 99.9, color: '#FAC775' },
  { id: 'bun', name: 'Bun', framework: 'Hono', avgLatency: 11.3, successRate: 98.5, color: '#F4C0D1' },
  { id: 'node', name: 'Node', framework: 'Express', avgLatency: 14.2, successRate: 97.8, color: '#AFA9EC' },
  { id: 'python', name: 'Python', framework: 'FastAPI', avgLatency: 12.7, successRate: 98.2, color: '#ED93B1' },
  { id: 'php', name: 'PHP', framework: 'Laravel', avgLatency: 13.5, successRate: 97.5, color: '#7F77DD' },
];

export const activeRuntime = writable<Runtime | null>(null);
export const comparisonRuntime = writable<Runtime | null>(null);
export const isComparing = writable<boolean>(false);
export const showComparisonModal = writable<boolean>(false);
export const testResults = writable<{ latency: number; db: number; logic: number; network: number; timestamp: string } | null>(null);
export const isRunningTest = writable<boolean>(false);