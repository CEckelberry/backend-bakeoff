/**
 * GCP Cloud Monitoring API integration
 * Fetches metrics from Google Cloud Run deployments
 */

interface CloudRunMetrics {
  runtime: string;
  coldStartTime?: number; // milliseconds
  memoryUsage?: number; // MB
  cpuTime?: number; // milliseconds
  latencyP95?: number; // milliseconds
  requestCount?: number;
  errorRate?: number; // percentage
}

/**
 * Fetch Cloud Monitoring metrics for a runtime
 * Requires GCP authentication (typically via GCP_PROJECT_ID in env)
 */
export async function fetchCloudRunMetrics(
  runtime: string,
  projectId: string,
  serviceName: string,
  minutesBack: number = 5
): Promise<CloudRunMetrics | null> {
  try {
    // For local development, return null
    // In production, this would call Google Cloud Monitoring API
    if (!projectId || projectId === 'local') {
      return null;
    }

    // Get auth token (server-side only)
    const response = await fetch('/api/cloud-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runtime,
        projectId,
        serviceName,
        minutesBack,
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch Cloud Monitoring metrics for ${runtime}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Error fetching Cloud Run metrics: ${error}`);
    return null;
  }
}

/**
 * Parse Cloud Monitoring time series response
 * Extracts relevant metrics like P95 latency, memory usage, etc.
 */
export function parseCloudMetrics(
  timeSeriesData: any[],
  metricType: string
): number[] {
  try {
    return timeSeriesData.map((ts) => {
      const points = ts.points || [];
      if (points.length === 0) return 0;
      // Most recent data point
      const value = points[0].value;
      return value.doubleValue || value.int64Value || 0;
    });
  } catch (error) {
    console.warn(`Error parsing Cloud metrics: ${error}`);
    return [];
  }
}

/**
 * Get query for Cloud Monitoring
 * Returns PromQL-like queries that work with Cloud Monitoring
 */
export function getCloudRunQuery(
  runtime: string,
  metric: 'latency' | 'memory' | 'cpu' | 'coldStart' | 'errors'
): string {
  const serviceFilter = `resource.label.service_name="${runtime}"`;

  const metricQueries: Record<string, string> = {
    latency: `resource.type="cloud_run_revision" AND ${serviceFilter} AND metric.type="run.googleapis.com/request_latencies"`,
    memory: `resource.type="cloud_run_revision" AND ${serviceFilter} AND metric.type="run.googleapis.com/request_count"`,
    cpu: `resource.type="cloud_run_revision" AND ${serviceFilter} AND metric.type="compute.googleapis.com/instance/cpu/utilization"`,
    coldStart: `resource.type="cloud_run_revision" AND ${serviceFilter}`,
    errors: `resource.type="cloud_run_revision" AND ${serviceFilter} AND metric.type="cloudfunctions.googleapis.com/execution_times"`,
  };

  return metricQueries[metric] || '';
}

/**
 * Format Cloud Run metric for display
 */
export function formatCloudMetric(value: number | undefined, metricType: string): string {
  if (value === undefined || value === null) return 'N/A';

  switch (metricType) {
    case 'latency':
    case 'coldStart':
      return `${Math.round(value)}ms`;
    case 'memory':
      return `${Math.round(value)}MB`;
    case 'cpu':
      return `${(value * 100).toFixed(1)}%`;
    case 'errors':
      return `${value.toFixed(2)}%`;
    default:
      return String(value);
  }
}
