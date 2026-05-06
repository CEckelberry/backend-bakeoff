# Phase 1: Go Backend Implementation

**Goal**: Implement a production-grade Go backend that conforms to `api/openapi.yaml`, serves the checkout endpoint, collects metrics, and traces requests.

**Status**: Specification for automated LLM implementation via lisaria-architect (Gemma4-31B)

**Duration**: ~1-2 days (local development only; GCP deployment in Phase 2)

---

## Overview

This phase implements the first backend in the 6-runtime benchmark. The Go backend will:

1. **Implement the OpenAPI contract** (`api/openapi.yaml`)
   - `POST /checkout` — process orders, apply tax, compute fraud score
   - `GET /health` — confirm database connectivity

2. **Use chi + stdlib** for HTTP handling
   - Lightweight, idiomatic Go
   - Production-grade but minimal ceremony

3. **Connect to Postgres** via `pgx`
   - Use the `bakeoff_go` schema
   - Connection pool of 20
   - Query products, insert orders, handle transactions

4. **Call the tax service**
   - HTTP POST to `http://tax-service:8080/tax`
   - Request: `{ subtotal_cents, state }`
   - Response: `{ tax_cents }`

5. **Export observability**
   - Prometheus metrics on `:9090/metrics`
   - OpenTelemetry traces to `otel-collector:4317` (gRPC)
   - JSON logs to stdout with `request_id`, `duration_ms`

6. **Stay within SLA**
   - p50 latency: < 50ms
   - p95 latency: < 150ms
   - startup time: < 5s

---

## Requirements (From RUNTIMES.md, Go Section)

### Framework & Dependencies
- **Framework**: `chi` (HTTP routing) + `stdlib` (net/http)
- **Driver**: `pgx/v5` for Postgres (binary protocol, fast)
- **OTel**: `go.opentelemetry.io/otel`, `otelhttp` instrumentation
- **Metrics**: `github.com/prometheus/client_golang`
- **Logging**: `log/slog` (stdlib structured logging)
- **HTTP**: Standard `net/http.Server` with explicit timeouts

### Project Structure
```
apps/backends/go/
├── cmd/server/main.go               ← initialization, graceful shutdown
├── internal/
│   ├── http/
│   │   ├── router.go                ← chi setup, middleware chain
│   │   ├── middleware.go            ← logging, request ID, recover, OTel
│   │   └── handlers/
│   │       ├── checkout.go          ← POST /checkout
│   │       └── health.go            ← GET /health
│   ├── domain/
│   │   ├── checkout.go              ← business logic (no HTTP concerns)
│   │   └── fraud.go                 ← fraud_score calculation
│   ├── store/
│   │   ├── postgres.go              ← pgxpool initialization
│   │   └── orders.go                ← CRUD operations
│   ├── tax/
│   │   └── client.go                ← HTTP client for tax service
│   ├── observability/
│   │   ├── metrics.go               ← Prometheus collectors
│   │   └── tracing.go               ← OTel SDK initialization
│   └── config/
│       └── config.go                ← environment variable loading
├── Dockerfile
├── go.mod
└── go.sum
```

### Cross-Runtime Constraints (From METHODOLOGY.md)
- **Listen**: `:8080` (HTTP/1.1, plaintext)
- **Health**: `GET /health` returns 200 only when DB is reachable
- **Metrics**: Prometheus scrape on `:9090/metrics`
- **Traces**: OTel gRPC to `otel-collector:4317`
- **Logs**: JSON, structured, with fields: `ts`, `level`, `msg`, `runtime`, `request_id`
- **Config**: All from environment variables (`DATABASE_URL`, `TAX_SERVICE_URL`, `LOG_LEVEL`, `RUNTIME_NAME`)
- **Connection pool**: Exactly 20 to the database
- **Container**: Distroless, non-root user, no shell
- **Startup**: < 5s from start to health passing

---

## Detailed Implementation Tasks

### 1. Project Setup

**File**: `apps/backends/go/go.mod`
```
module backend-bakeoff-go

go 1.23

require (
  github.com/go-chi/chi/v5 v5.0.11
  github.com/jackc/pgx/v5 v5.5.5
  github.com/prometheus/client_golang v1.18.0
  go.opentelemetry.io/otel v1.21.0
  go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v0.45.0
  go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.21.0
  go.opentelemetry.io/otel/metric v1.21.0
  go.opentelemetry.io/otel/sdk v1.21.0
  go.opentelemetry.io/otel/sdk/metric v1.21.0
  go.opentelemetry.io/otel/trace v1.21.0
)
```

**Execution**:
```bash
cd apps/backends/go
go mod init backend-bakeoff-go
go mod tidy
```

### 2. Configuration (`internal/config/config.go`)

Load environment variables at startup:

```go
type Config struct {
    DatabaseURL    string
    TAXServiceURL  string
    LogLevel       string
    RuntimeName    string
    ListenAddr     string  // default :8080
}

func Load() (*Config, error) {
    // Load from env vars, validate URLs, set defaults
}
```

**Required env vars**:
- `DATABASE_URL` — postgres://user:pass@db:5432/bakeoff (search_path=bakeoff_go)
- `TAX_SERVICE_URL` — http://tax-service:8080
- `LOG_LEVEL` — info, debug (default: info)
- `RUNTIME_NAME` — go (for metrics/logs)

### 3. Database Layer

#### 3a. `internal/store/postgres.go` — Connection Pool Init

```go
type PostgresStore struct {
    pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
    // Parse connectionstring, set search_path
    // pgxpool.Config with MaxConns: 20, MinConns: 5
    // Handle migrations (or assume they're pre-run by seed.sh)
    // Return error if can't connect within 5 seconds
}

func (ps *PostgresStore) Health(ctx context.Context) error {
    // SELECT 1 to verify connectivity
}

func (ps *PostgresStore) Close() error {
    // pool.Close()
}
```

#### 3b. `internal/store/orders.go` — CRUD

```go
type Order struct {
    ID         uuid.UUID
    CustomerID uuid.UUID
    TotalCents int
    TaxCents   int
    CreatedAt  time.Time
}

type OrderItem struct {
    ID         uuid.UUID
    OrderID    uuid.UUID
    ProductID  uuid.UUID
    Quantity   int
    PriceCents int
}

func (ps *PostgresStore) GetProduct(ctx context.Context, productID uuid.UUID) (*Product, error)
func (ps *PostgresStore) InsertOrder(ctx context.Context, order *Order, items []OrderItem) error
```

### 4. Business Logic

#### 4a. `internal/domain/checkout.go` — Orchestration

```go
type CheckoutRequest struct {
    CustomerID string `json:"customer_id"`
    Items      []struct {
        ProductID string `json:"product_id"`
        Quantity  int    `json:"quantity"`
    } `json:"items"`
    State string `json:"state"`
}

type CheckoutResponse struct {
    OrderID    string `json:"order_id"`
    TotalCents int    `json:"total_cents"`
    TaxCents   int    `json:"tax_cents"`
    FraudScore int    `json:"fraud_score"`
}

func ProcessCheckout(ctx context.Context, req CheckoutRequest, store *PostgresStore, taxClient *TaxClient) (*CheckoutResponse, error) {
    // 1. Fetch all products from store
    // 2. Validate cart (1-8 items, all exist, sufficient stock)
    // 3. Calculate subtotal
    // 4. Call tax service
    // 5. Compute fraud score
    // 6. Insert order + items in transaction
    // 7. Return response
}
```

#### 4b. `internal/domain/fraud.go` — Fraud Score

```go
func ComputeFraudScore(totalCents int, itemCount int) int {
    // Simple rule: (totalCents / 100) + (itemCount * 10)
    // Example: $50 order with 3 items = 50 + 30 = 80
}
```

### 5. Tax Service Client

**File**: `internal/tax/client.go`

```go
type Client struct {
    baseURL    string
    httpClient *http.Client
}

type TaxRequest struct {
    SubtotalCents int    `json:"subtotal_cents"`
    State         string `json:"state"`
}

type TaxResponse struct {
    TaxCents int `json:"tax_cents"`
}

func (c *Client) CalculateTax(ctx context.Context, req TaxRequest) (*TaxResponse, error) {
    // HTTP POST to {baseURL}/tax
    // Timeout: 2s
    // Return error if service unreachable
}
```

### 6. HTTP Handlers

#### 6a. `internal/http/handlers/checkout.go`

```go
func HandleCheckout(store *PostgresStore, taxClient *TaxClient) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Parse request body
        // Call domain.ProcessCheckout()
        // Return JSON response with status 201, or error with appropriate status
        // Handle validation errors (400), not found (404), conflict (422), server errors (500)
    }
}
```

#### 6b. `internal/http/handlers/health.go`

```go
func HandleHealth(store *PostgresStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Call store.Health(ctx)
        // If OK: return 200 { "status": "ok" }
        // If error: return 503 { "status": "unhealthy" }
    }
}
```

### 7. Middleware

**File**: `internal/http/middleware.go`

Implement these middleware in order:
1. **Request ID**: Generate or extract from header, add to context
2. **Structured Logging**: Log each request start and end with duration
3. **Panic Recovery**: Recover from panics, return 500
4. **OTel Tracing**: Use `otelhttp.Middleware()` to instrument

### 8. Router Setup

**File**: `internal/http/router.go`

```go
func NewRouter(store *PostgresStore, taxClient *TaxClient, meter metric.Meter, tracer trace.Tracer) *chi.Mux {
    r := chi.NewRouter()
    
    // Apply middleware stack
    r.Use(middleware.RequestID)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    
    // Routes
    r.Get("/health", handlers.HandleHealth(store))
    r.Post("/checkout", handlers.HandleCheckout(store, taxClient))
    
    // Metrics
    r.Get("/metrics", prometheus.Handler())
    
    return r
}
```

### 9. Observability

#### 9a. `internal/observability/metrics.go` — Prometheus

```go
var (
    checkoutLatencyHistogram prometheus.Histogram
    checkoutStatusCounter    prometheus.Counter
)

func InitMetrics() {
    // Create histogram for /checkout latency (buckets: 10, 50, 100, 250, 500, 1000ms)
    // Create counter for successful/failed checkouts
    // Register with default registry
}
```

#### 9b. `internal/observability/tracing.go` — OTel

```go
func InitTracing(ctx context.Context) (*sdktrace.TracerProvider, error) {
    // Create gRPC exporter to otel-collector:4317
    // Create BatchSpanProcessor
    // Create TracerProvider with processor
    // Set as global
    // Return provider
}
```

### 10. Main Entry Point

**File**: `cmd/server/main.go`

```go
func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // 1. Load config
    cfg := config.Load()
    
    // 2. Initialize observability
    tp, _ := observability.InitTracing(ctx)
    defer tp.Shutdown(context.Background())
    observability.InitMetrics()
    
    // 3. Connect to database
    store, _ := store.NewPostgresStore(ctx, cfg.DatabaseURL)
    defer store.Close()
    
    // 4. Initialize tax client
    taxClient := tax.NewClient(cfg.TAXServiceURL)
    
    // 5. Setup router
    router := http.NewRouter(store, taxClient, ...)
    
    // 6. Start server with timeouts
    server := &http.Server{
        Addr:         ":8080",
        Handler:      router,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    
    // 7. Graceful shutdown on SIGTERM
    go func() {
        sigint := make(chan os.Signal, 1)
        signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
        <-sigint
        
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        server.Shutdown(ctx)
    }()
    
    server.ListenAndServe()
}
```

### 11. Dockerfile

**File**: `apps/backends/go/Dockerfile`

```dockerfile
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags='-s -w' -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

---

## Testing & Verification

### Unit Tests (Local)

Create `internal/domain/checkout_test.go`:
- Test `ComputeFraudScore` with known inputs
- Test `ProcessCheckout` with mock store/tax client

### Integration Tests (With Docker Compose)

```bash
# 1. Start all services
make dev

# 2. Wait for health
curl http://localhost:8081/health

# 3. Test checkout
curl -X POST http://localhost:8081/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {"product_id": "product-uuid-1", "quantity": 2}
    ],
    "state": "CA"
  }'

# Expected: 201 with order ID, totals, fraud score

# 4. Verify metrics
curl http://localhost:9090/api/v1/query?query=checkout_requests_total

# 5. Verify database
psql -h localhost -U postgres -d bakeoff -c "SELECT * FROM bakeoff_go.orders LIMIT 5;"
```

### Acceptance Criteria

✅ **HTTP Contract**
- `POST /checkout` returns 201 on success
- `GET /health` returns 200 when DB is up, 503 when down
- All requests are logged with `request_id` and `duration_ms`
- Errors return appropriate status (400, 422, 500, 503)

✅ **Latency**
- p50: < 50ms (measured via Prometheus histogram)
- p95: < 150ms
- p99: < 300ms

✅ **Database**
- Orders inserted into `bakeoff_go.orders` with correct data
- Order items inserted into `bakeoff_go.order_items`
- Product stock is validated before insert

✅ **Observability**
- Metrics exported on `GET /metrics`
- Traces visible in otel-collector (or Jaeger)
- Logs are valid JSON with `runtime: go`

✅ **Container**
- Distroless image (no shell)
- Runs as `nonroot:nonroot`
- Startup under 5s
- Health endpoint responding before startup completes

---

## Execution Strategy

1. **LLM reads this spec** + `RUNTIMES.md` (Go section) + `api/openapi.yaml`
2. **LLM implements all files** in the project structure
3. **LLM creates Dockerfile** and tests locally
4. **Human runs** `make dev && bash scripts/audit-methodology.sh`
5. **Verify** database has orders, metrics work, logs are JSON
6. **Human commits** with message: "phase-1: Go backend implementation"
7. **Human pushes** to GitHub and opens PR to main

---

## Success Criteria (Phase 1 Complete)

- ✅ All files created with exact paths
- ✅ `go mod tidy` completes without errors
- ✅ `docker build apps/backends/go` produces distroless image (~15MB)
- ✅ `make dev` starts all 9 services
- ✅ `curl http://localhost:8081/health` returns 200
- ✅ `curl http://localhost:8081/checkout` with sample payload returns 201
- ✅ `bash scripts/audit-methodology.sh` passes
- ✅ Database shows orders in `bakeoff_go.orders`
- ✅ Prometheus scrapes metrics from `localhost:9090/metrics`
- ✅ All logs are valid JSON on stdout

---

## Notes for LLM Implementation

1. **Use context heavily** — all async operations take `context.Context` as first argument
2. **Handle errors gracefully** — wrap errors with context, log them, return appropriate HTTP status
3. **Timeouts** — set 2s timeout on tax service calls, 5s on database operations
4. **Transactions** — use for order + items insert to ensure atomicity
5. **Connection pool** — pgxpool handles cleanup; just call `Close()` on shutdown
6. **Structured logging** — use `log/slog` for all logs, include `request_id` in every log entry
7. **Idempotency** — order IDs are UUIDs; checkout is not idempotent by design (each call creates new order)
8. **Graceful shutdown** — listen for SIGTERM, drain in-flight requests, close DB pool, shut down OTel
9. **No TODOs** — all code should be production-ready; no placeholders or `// TODO`

---

## Timelines & Expectations

- **Coding**: 2-4 hours (LLM alone via automated script)
- **Testing**: 30-60 minutes (human manual testing + verification)
- **Debugging**: If needed, < 1 hour (LLM can iterate on failures)
- **Total**: 1-2 days wall-clock time

---

## Git Commit Message

```
phase-1: Go backend implementation

- chi + stdlib HTTP server listening on :8080
- pgx connection pool (20 connections) to bakeoff_go schema
- POST /checkout handler: validate cart, compute tax, fraud score
- GET /health endpoint: validates DB connectivity
- Prometheus metrics: checkout latency, request counts
- OTel tracing: gRPC export to otel-collector:4317
- Structured JSON logging with request_id and duration
- Distroless Dockerfile (~15MB final image)
- Graceful shutdown on SIGTERM
- Passes audit: contract conformance, latency SLA, observability
```

---

## References

- **OpenAPI Contract**: `api/openapi.yaml`
- **Methodology**: `METHODOLOGY.md` (cross-runtime rules)
- **RUNTIMES.md**: Go section (framework details, gotchas)
- **Docker Compose**: `docker-compose.yml` (9 services, networking)
- **Phase 0 Schema**: `packages/seed-data/migrations/001_init.sql` (bakeoff_go schema)
