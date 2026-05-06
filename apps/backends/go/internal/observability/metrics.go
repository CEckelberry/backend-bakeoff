package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"method", "endpoint", "status"})

	HTTPRequestDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "endpoint"})

	CheckoutLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "checkout_latency_seconds",
		Help:    "Latency of checkout requests",
		Buckets: []float64{.01, .05, .1, .25, .5, 1},
	}, []string{"status"})

	CheckoutRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "checkout_requests_total",
		Help: "Total number of checkout requests",
	}, []string{"status"})
)
