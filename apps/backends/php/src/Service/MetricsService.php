<?php

namespace App\Service;

class MetricsService
{
    private const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];

    // Static so they survive across Symfony kernel reboots within the same FrankenPHP worker process.
    /** @var array<string, int> */
    private static array $counters = [];
    /** @var array<string, array{sum: float, count: int, buckets: array<string, int>}> */
    private static array $histograms = [];

    public function record(string $method, string $endpoint, int $status, float $duration): void
    {
        $ck = "{$method}:{$endpoint}:{$status}";
        self::$counters[$ck] = (self::$counters[$ck] ?? 0) + 1;

        if (!isset(self::$histograms[$endpoint])) {
            self::$histograms[$endpoint] = ['sum' => 0.0, 'count' => 0, 'buckets' => []];
        }
        $h = &self::$histograms[$endpoint];
        $h['sum']   += $duration;
        $h['count'] += 1;
        foreach (self::BUCKETS as $le) {
            if ($duration <= $le) {
                $ls = (string) $le;
                $h['buckets'][$ls] = ($h['buckets'][$ls] ?? 0) + 1;
            }
        }
    }

    public function render(): string
    {
        $rss = 0;
        if (file_exists('/proc/self/status')) {
            if (preg_match('/VmRSS:\s+(\d+)\s+kB/', (string) file_get_contents('/proc/self/status'), $m)) {
                $rss = (int) $m[1] * 1024;
            }
        }
        if ($rss === 0) {
            $rss = memory_get_usage(true);
        }

        $out  = "# HELP process_resident_memory_bytes Resident memory size in bytes.\n";
        $out .= "# TYPE process_resident_memory_bytes gauge\n";
        $out .= "process_resident_memory_bytes {$rss}\n";

        $out .= "# HELP http_requests_total Total HTTP requests.\n";
        $out .= "# TYPE http_requests_total counter\n";
        foreach (self::$counters as $key => $v) {
            [$me, $ep, $st] = explode(':', $key, 3);
            $out .= "http_requests_total{method=\"{$me}\",endpoint=\"{$ep}\",status=\"{$st}\"} {$v}\n";
        }

        $out .= "# HELP http_request_duration_seconds HTTP request duration in seconds.\n";
        $out .= "# TYPE http_request_duration_seconds histogram\n";
        foreach (self::$histograms as $key => $h) {
            [$me, $ep] = explode(':', $key, 2);
            ksort($h['buckets']);
            foreach ($h['buckets'] as $le => $cnt) {
                $out .= "http_request_duration_seconds_bucket{method=\"{$me}\",endpoint=\"{$ep}\",le=\"{$le}\"} {$cnt}\n";
            }
            $out .= "http_request_duration_seconds_bucket{method=\"{$me}\",endpoint=\"{$ep}\",le=\"+Inf\"} {$h['count']}\n";
            $out .= "http_request_duration_seconds_sum{method=\"{$me}\",endpoint=\"{$ep}\"} {$h['sum']}\n";
            $out .= "http_request_duration_seconds_count{method=\"{$me}\",endpoint=\"{$ep}\"} {$h['count']}\n";
        }

        return $out;
    }
}
