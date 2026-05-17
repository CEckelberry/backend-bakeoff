require 'prometheus/client'

PROMETHEUS_REGISTRY = Prometheus::Client.registry

CHECKOUT_REQUESTS = PROMETHEUS_REGISTRY.counter(
  :checkout_requests_total,
  docstring: 'Total checkout requests',
  labels: [:status]
)

CHECKOUT_DURATION = PROMETHEUS_REGISTRY.histogram(
  :checkout_duration_seconds,
  docstring: 'Checkout request duration in seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
)

PROCESS_CPU_SECONDS = PROMETHEUS_REGISTRY.gauge(
  :process_cpu_seconds_total,
  docstring: 'Total user and system CPU time spent in seconds.'
)

PROCESS_RESIDENT_MEMORY = PROMETHEUS_REGISTRY.gauge(
  :process_resident_memory_bytes,
  docstring: 'Resident memory size in bytes.'
)

module ProcessMetrics
  def self.update
    PROCESS_CPU_SECONDS.set(Process.clock_gettime(Process::CLOCK_PROCESS_CPUTIME_ID))
    if File.exist?('/proc/self/status')
      line = File.readlines('/proc/self/status').find { |l| l.start_with?('VmRSS:') }
      PROCESS_RESIDENT_MEMORY.set(line.split[1].to_i * 1024) if line
    end
  end
end
