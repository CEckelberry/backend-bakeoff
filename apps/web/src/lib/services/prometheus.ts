// Prometheus API client — proxied through SvelteKit server route
const PROMETHEUS_URL = '/api/prometheus';

export interface PrometheusMetric {
  timestamp: number;
  value: number;
}

/**
 * Query Prometheus for the latest value of a metric
 */
export async function queryPrometheus(query: string): Promise<PrometheusMetric[]> {
  try {
    const response = await fetch(`${PROMETHEUS_URL}/query?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Prometheus error: ${response.statusCode}`);
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(`Prometheus query failed: ${data.status}`);
    }
    
    return data.data.result.map(result => ({
      timestamp: parseInt(result.value[0]) * 1000,
      value: parseFloat(result.value[1]),
    }));
  } catch (error) {
    console.error('Prometheus query error:', error);
    return [];
  }
}

/**
 * Get latency percentiles for a specific runtime
 */
export async function getRuntimeLatency(runtime: string): Promise<{
  p50: number;
  p95: number;
  p99: number;
}> {
  try {
    // Try http_request_duration_seconds first (Go, Node, Python)
    let p50Query = `histogram_quantile(0.50,http_request_duration_seconds_bucket{instance=~"bo-${runtime}:.*"})`;
    let p95Query = `histogram_quantile(0.95,http_request_duration_seconds_bucket{instance=~"bo-${runtime}:.*"})`;
    let p99Query = `histogram_quantile(0.99,http_request_duration_seconds_bucket{instance=~"bo-${runtime}:.*"})`;

    let [p50Results, p95Results, p99Results] = await Promise.all([
      queryPrometheus(p50Query),
      queryPrometheus(p95Query),
      queryPrometheus(p99Query),
    ]);

    // If no results, try checkout_latency_seconds (Rust, Bun, PHP)
    if (p50Results.length === 0) {
      p50Query = `histogram_quantile(0.50,checkout_latency_seconds_bucket{instance=~"bo-${runtime}:.*"})`;
      p95Query = `histogram_quantile(0.95,checkout_latency_seconds_bucket{instance=~"bo-${runtime}:.*"})`;
      p99Query = `histogram_quantile(0.99,checkout_latency_seconds_bucket{instance=~"bo-${runtime}:.*"})`;

      [p50Results, p95Results, p99Results] = await Promise.all([
        queryPrometheus(p50Query),
        queryPrometheus(p95Query),
        queryPrometheus(p99Query),
      ]);
    }

    return {
      p50: (p50Results[0]?.value || 0) * 1000,
      p95: (p95Results[0]?.value || 0) * 1000,
      p99: (p99Results[0]?.value || 0) * 1000,
    };
  } catch (error) {
    console.error('Failed to get runtime latency:', error);
    return { p50: 0, p95: 0, p99: 0 };
  }
}

/**
 * Get throughput (total requests) for a runtime
 */
export async function getRuntimeThroughput(runtime: string): Promise<number> {
  try {
    // Try http_requests_total first (Go, Node, Python)
    let query = `sum(http_requests_total{instance=~"bo-${runtime}:.*"})`;
    let results = await queryPrometheus(query);

    // If no results, try checkout_requests_total (Rust, Bun, PHP)
    if (results.length === 0) {
      query = `sum(checkout_requests_total{instance=~"bo-${runtime}:.*"})`;
      results = await queryPrometheus(query);
    }

    if (results.length === 0) return 0;
    return Math.round(results[0].value);
  } catch (error) {
    console.error('Failed to get runtime throughput:', error);
    return 0;
  }
}

/**
 * Get error rate for a runtime
 */
export async function getRuntimeErrorRate(runtime: string): Promise<number> {
  try {
    // Try http_requests_total first (Go, Node, Python)
    let errorQuery = `sum(http_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."})`;
    let totalQuery = `sum(http_requests_total{instance=~"bo-${runtime}:.*"})`;
    
    let [errorResults, totalResults] = await Promise.all([
      queryPrometheus(errorQuery),
      queryPrometheus(totalQuery),
    ]);

    // If no results, try checkout metrics (Rust, Bun, PHP)
    if (totalResults.length === 0) {
      errorQuery = `sum(checkout_requests_total{instance=~"bo-${runtime}:.*",status=~"5.."})`;
      totalQuery = `sum(checkout_requests_total{instance=~"bo-${runtime}:.*"})`;
      
      [errorResults, totalResults] = await Promise.all([
        queryPrometheus(errorQuery),
        queryPrometheus(totalQuery),
      ]);
    }

    if (!totalResults[0] || totalResults[0].value === 0) return 0;
    
    const errors = errorResults[0]?.value || 0;
    const total = totalResults[0].value;
    
    return (errors / total) * 100;
  } catch (error) {
    console.error('Failed to get runtime error rate:', error);
    return 0;
  }
}

/**
 * Debug: Log all available metrics for a runtime
 */
export async function debugRuntimeMetrics(runtime: string): Promise<any> {
  try {
    const latency = await getRuntimeLatency(runtime);
    const throughput = await getRuntimeThroughput(runtime);
    const errorRate = await getRuntimeErrorRate(runtime);
    
    console.log(`Debug metrics for ${runtime}:`, {
      latency,
      throughput,
      errorRate,
    });
    
    return { latency, throughput, errorRate };
  } catch (error) {
    console.error('Debug failed:', error);
    return null;
  }
}

/**
 * Query Prometheus for time range data
 */
export async function queryPrometheusRange(
  query: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (minutesBack * 60);
    const step = Math.max(15, Math.floor((end - start) / 50)); // ~50 data points

    const response = await fetch(
      `${PROMETHEUS_URL}/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
    );
    if (!response.ok) throw new Error(`Prometheus error: ${response.statusCode}`);
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(`Prometheus range query failed: ${data.status}`);
    }
    
    const results: PrometheusMetric[] = [];
    
    if (data.data.result.length > 0) {
      const values = data.data.result[0].values || [];
      for (const [timestamp, value] of values) {
        results.push({
          timestamp: parseInt(timestamp) * 1000,
          value: parseFloat(value),
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Prometheus range query error:', error);
    return [];
  }
}

/**
 * Get latency history for a runtime over time
 */
export async function getRuntimeLatencyHistory(
  runtime: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    // Aggregate across all endpoint labels so we get one series per instance
    let query = `histogram_quantile(0.95,sum by(instance,le)(rate(http_request_duration_seconds_bucket{instance=~"bo-${runtime}:.*"}[1m])))`;
    let results = await queryPrometheusRange(query, minutesBack);

    // If no results, try checkout_duration_seconds (Rails)
    if (results.length === 0) {
      query = `histogram_quantile(0.95,sum by(instance,le)(rate(checkout_duration_seconds_bucket{instance=~"bo-${runtime}:.*"}[1m])))`;
      results = await queryPrometheusRange(query, minutesBack);
    }

    // Convert to milliseconds
    return results.map(r => ({
      ...r,
      value: r.value * 1000,
    }));
  } catch (error) {
    console.error('Failed to get runtime latency history:', error);
    return [];
  }
}

/**
 * Get P99 latency history for a runtime over time
 */
export async function getRuntimeP99History(
  runtime: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    let query = `histogram_quantile(0.99,sum by(instance,le)(rate(http_request_duration_seconds_bucket{instance=~"bo-${runtime}:.*"}[1m])))`;
    let results = await queryPrometheusRange(query, minutesBack);
    if (results.length === 0) {
      query = `histogram_quantile(0.99,sum by(instance,le)(rate(checkout_duration_seconds_bucket{instance=~"bo-${runtime}:.*"}[1m])))`;
      results = await queryPrometheusRange(query, minutesBack);
    }
    return results.map(r => ({ ...r, value: r.value * 1000 }));
  } catch {
    return [];
  }
}

/**
 * Get memory usage (MB) history for a runtime over time
 */
export async function getRuntimeMemoryHistory(
  runtime: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    const query = `process_resident_memory_bytes{instance=~"bo-${runtime}:.*"} / 1048576`;
    return await queryPrometheusRange(query, minutesBack);
  } catch {
    return [];
  }
}

/**
 * Get Apdex score history for a runtime (T=50ms: satisfied <50ms, tolerating <200ms)
 */
export async function getRuntimeApdexHistory(
  runtime: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    const inst = `instance=~"bo-${runtime}:.*"`;
    // Using le="0.05" (50ms) and le="0.2" (200ms) buckets
    const query = `(
      sum by(instance)(rate(http_request_duration_seconds_bucket{${inst},le="0.05"}[1m])) +
      0.5 * (
        sum by(instance)(rate(http_request_duration_seconds_bucket{${inst},le="0.2"}[1m])) -
        sum by(instance)(rate(http_request_duration_seconds_bucket{${inst},le="0.05"}[1m]))
      )
    ) / sum by(instance)(rate(http_request_duration_seconds_count{${inst}}[1m]))`;
    const results = await queryPrometheusRange(query, minutesBack);
    // Clamp to [0, 1]
    return results.map(r => ({ ...r, value: Math.min(1, Math.max(0, r.value)) }));
  } catch {
    return [];
  }
}

/**
 * Get throughput history for a runtime over time
 */
export async function getRuntimeThroughputHistory(
  runtime: string,
  minutesBack: number = 5
): Promise<PrometheusMetric[]> {
  try {
    // Sum across endpoints so we get one series per instance
    let query = `sum by(instance)(rate(http_requests_total{instance=~"bo-${runtime}:.*"}[1m]))`;
    let results = await queryPrometheusRange(query, minutesBack);

    // If no results, try checkout_requests_total
    if (results.length === 0) {
      query = `sum by(instance)(rate(checkout_requests_total{instance=~"bo-${runtime}:.*"}[1m]))`;
      results = await queryPrometheusRange(query, minutesBack);
    }

    return results;
  } catch (error) {
    console.error('Failed to get runtime throughput history:', error);
    return [];
  }
}
