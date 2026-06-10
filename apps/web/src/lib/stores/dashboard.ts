import { writable } from 'svelte/store';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface Runtime {
	id: string;
	name: string;
	framework: string;
	version: string;
}

export interface DashboardState {
	selectedRuntime: string;
	runtimes: Runtime[];
	isWarmup: boolean;
	warmupProgress: number;
	healthStatus: HealthStatus;
	error: string | null;
	windowWidth: number;
	isWarmingUp: boolean;
}

export const runtimes: Runtime[] = [
	{ id: 'go', name: 'Go', framework: 'Fiber v2', version: '1.21' },
	{ id: 'rust', name: 'Rust', framework: 'Axum', version: '1.74' },
	{ id: 'bun', name: 'Bun', framework: 'Hono', version: '1.0' },
	{ id: 'node', name: 'Node.js', framework: 'Fastify', version: '20' },
	{ id: 'python', name: 'Python', framework: 'FastAPI', version: '3.12' },
	{ id: 'php', name: 'PHP', framework: 'Symfony', version: '8.3' }
];

export const dashboard = writable<DashboardState>({
	selectedRuntime: 'go',
	runtimes,
	isWarmup: false,
	isWarmingUp: false,
	warmupProgress: 0,
	healthStatus: 'healthy',
	error: null,
	windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
});

export const initDashboard = () => {
	let progress = 0;
	const interval = setInterval(() => {
		progress += 5;
		dashboard.update(d => ({
			...d,
			warmupProgress: progress,
			isWarmup: progress < 100
		}));
		
		if (progress >= 100) {
			clearInterval(interval);
			dashboard.update(d => ({
				...d,
				isWarmup: false
			}));
		}
	}, 100);
};

// Handle window resize
if (typeof window !== 'undefined') {
	window.addEventListener('resize', () => {
		dashboard.update(d => ({
			...d,
			windowWidth: window.innerWidth
		}));
	});
}
