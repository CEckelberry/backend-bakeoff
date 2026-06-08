export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface RuntimeMetrics {
  [runtime: string]: MetricPoint[];
}

export interface MetricSnapshot {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
  avg: number;
  count: number;
}
