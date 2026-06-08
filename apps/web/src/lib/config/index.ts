export interface Runtime {
	id: string;
	name: string;
	version: string;
}

export interface TimingData {
	label: string;
	value: number;
}

export interface MetricData {
	latency: number;
	memory: number;
	cpu: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DashboardState {
	selectedRuntime: string;
	runtimes: Runtime[];
	isWarmup: boolean;
	warmupProgress: number;
	healthStatus: HealthStatus;
	error: { message: string } | null;
	windowWidth: number;
}