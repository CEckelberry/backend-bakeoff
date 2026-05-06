package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
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
