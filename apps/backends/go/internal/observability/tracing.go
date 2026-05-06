package observability

import (
	"context"
)

// InitTracing is disabled to reduce latency
// The gRPC connection to otel-collector was adding 2-3ms overhead per request
func InitTracing(ctx context.Context, serviceName string) error {
	// No-op: removed to eliminate latency overhead
	return nil
}
