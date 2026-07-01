package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

// Registry is a dedicated registry so we never touch prometheus.DefaultRegisterer,
// which avoids duplicate-collector panics caused by init-order surprises.
var Registry = prometheus.NewRegistry()

var (
	HTTPRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"method", "endpoint", "status"})

	HTTPRequestDurationSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "endpoint"})

	CheckoutLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "checkout_latency_seconds",
		Help:    "Latency of checkout requests",
		Buckets: []float64{.01, .05, .1, .25, .5, 1},
	}, []string{"status"})

	CheckoutRequests = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "checkout_requests_total",
		Help: "Total number of checkout requests",
	}, []string{"status"})
)

func init() {
	Registry.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDurationSeconds,
		CheckoutLatency,
		CheckoutRequests,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
}
