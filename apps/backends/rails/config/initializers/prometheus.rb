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
