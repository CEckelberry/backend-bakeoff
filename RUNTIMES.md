# Runtimes

The six backends, each with its own implementation spec. Every section here lists the framework choice, the project structure, the database driver, the dependency list, the Dockerfile pattern, and the gotchas specific to that runtime.

The methodology rules in `METHODOLOGY.md` apply to all six. This document is the runtime-specific detail beneath those rules.

---

## Cross-runtime requirements

Every backend, regardless of language, must satisfy these:

- **Implements** the OpenAPI contract at `api/openapi.yaml` exactly
- **Listens** on `:8080` (HTTP/1.1, plaintext)
- **Exports** Prometheus metrics on `:9090/metrics`
- **Exports** OTel traces to `otel-collector:4317` (gRPC) or `otel-collector:4318` (HTTP)
- **Logs** JSON to stdout with fields: `ts, level, msg, runtime, request_id, ...`
- **Health** endpoint at `GET /health` returning `200` only when DB is reachable
- **Connection pool** of exactly 20 to Cloud SQL
- **Reads config** from environment variables only:
  - `DATABASE_URL` — postgres connection string with schema set in `search_path`
  - `TAX_SERVICE_URL` — `http://tax-service:8080`
  - `LOG_LEVEL` — info, debug
  - `RUNTIME_NAME` — the runtime label (go, rust, etc.) used in metrics and logs
- **Container** is distroless or near-minimal, runs as non-root user, has no shell
- **Startup time** under 5s from container start to health endpoint passing

---

## 01 — Go

### Framework choice: chi + stdlib

`chi` is the most common production choice for Go HTTP services that don't need a heavy framework. It's a thin layer over `net/http`, lightweight middleware, and very close to what you'd write yourself. This is what most Go shops actually deploy.

Alternative considered and rejected: `gin`. It's popular but does more (parameter binding, validation built-in) than this benchmark needs, and it has a slightly more opinionated middleware model. `chi` is closer to the language's idiom.

### Project structure

```
apps/backends/go/
├── cmd/server/main.go               ← wiring, http.Server, graceful shutdown
├── internal/
│   ├── http/
│   │   ├── router.go                ← chi setup, middleware chain
│   │   ├── middleware.go            ← logging, request ID, recover, OTel
│   │   └── handlers/
│   │       ├── checkout.go          ← POST /checkout
│   │       └── health.go            ← GET /health
│   ├── domain/
│   │   ├── checkout.go              ← business logic, no HTTP
│   │   └── fraud.go                 ← the fraud_score function
│   ├── store/
│   │   ├── postgres.go              ← *pgxpool.Pool init, migrations
│   │   └── orders.go                ← CRUD
│   ├── tax/
│   │   └── client.go                ← HTTP client for tax service
│   ├── observability/
│   │   ├── metrics.go               ← prometheus collectors
│   │   └── tracing.go               ← OTel SDK init
│   └── config/
│       └── config.go                ← env var loading
├── Dockerfile
├── go.mod
└── go.sum
```

### Key dependencies

- `github.com/go-chi/chi/v5`
- `github.com/jackc/pgx/v5/pgxpool`
- `go.opentelemetry.io/otel` + `otelhttp` instrumentation
- `github.com/prometheus/client_golang`
- `log/slog` (stdlib structured logging)

### Database

`pgxpool.Pool` configured with `MaxConns: 20, MinConns: 5`. `pgx` is the canonical Go Postgres driver — it's faster than `database/sql + lib/pq` and it's what you'd use in production.

### Concurrency model

Goroutine per request, the standard `net/http` model. No worker count to tune.

### Gotchas

- Make sure `pgx` is using the binary protocol (default), not text. Text mode adds ~20% overhead.
- The default `http.Server` has timeouts of 0 (forever). Set `ReadTimeout: 5s`, `WriteTimeout: 10s`, `IdleTimeout: 60s`.
- `chi`'s default logger middleware allocates per-request. Use the lighter `httplog.NewLogger` or write a custom one.

### Dockerfile

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

Final image: ~15MB.

---

## 02 — Rust

### Framework choice: axum + tokio

`axum` is the modern Rust web framework written by the `tokio` team. Production-grade, idiomatic, integrates with the broader `tokio` ecosystem cleanly. This is what new Rust services are written in today.

Alternative considered and rejected: `actix-web`. Faster on some benchmarks, but `axum` is closer to the broader Rust async ecosystem and is what the language's HTTP work is converging on.

### Project structure

```
apps/backends/rust/
├── src/
│   ├── main.rs                       ← tokio::main, axum setup
│   ├── http/
│   │   ├── mod.rs
│   │   ├── router.rs                 ← axum Router
│   │   ├── middleware.rs             ← tracing, request ID
│   │   └── handlers/
│   │       ├── checkout.rs
│   │       └── health.rs
│   ├── domain/
│   │   ├── checkout.rs
│   │   └── fraud.rs
│   ├── store/
│   │   ├── mod.rs                    ← sqlx::PgPool init
│   │   └── orders.rs
│   ├── tax.rs                        ← reqwest client
│   ├── observability/
│   │   └── mod.rs                    ← tracing-subscriber + opentelemetry
│   └── config.rs
├── Dockerfile
├── Cargo.toml
└── Cargo.lock
```

### Key dependencies

- `axum` — the framework
- `tokio` — the async runtime
- `sqlx` — async Postgres driver with compile-time query checking
- `reqwest` — HTTP client for the tax service
- `tracing` + `tracing-opentelemetry` — instrumentation
- `prometheus` (the `prometheus` crate, not `metrics`)
- `serde` + `serde_json`

### Database

`sqlx::PgPool` with `max_connections(20)`. `sqlx` validates queries against the database at compile time, which means CI needs a running Postgres to compile (or use `sqlx prepare` to vendor query metadata).

### Concurrency model

`tokio` async runtime, work-stealing scheduler. Default worker thread count = number of cores. With 2 vCPU pods, that's 2 worker threads.

### Gotchas

- **Compilation time.** Rust's slow build is real. CI builds will take 3-5 minutes. Mitigate with `cargo-chef` for dependency layer caching in Docker.
- **`sqlx` offline mode.** For Docker builds without a live DB, use `SQLX_OFFLINE=true` and commit the `.sqlx/` directory.
- **`hyper`'s default keepalive timeout** is too short for some patterns. Increase to 60s.
- **Logging in async contexts.** `tracing` is the right choice; raw `println!` is not. Make sure all async functions use `#[tracing::instrument]` for trace propagation.

### Dockerfile

Multi-stage with `cargo-chef`:

```dockerfile
FROM rust:1.82-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /src

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /src/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /src/target/release/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

Final image: ~25MB.

---

## 03 — Bun

### Framework choice: hono

`hono` is a minimal, fast web framework that runs on Bun (and Node, Deno, Cloudflare Workers). It's the closest thing the JS world has to chi — small, focused, no surprises. Bun's own HTTP API is also fast, but `hono` adds routing and middleware ergonomics that real services need.

Alternative considered and rejected: Bun's raw `Bun.serve`. Faster in microbenchmarks but lacks the ergonomics for a real service (routing, middleware composition).

### Project structure

```
apps/backends/bun/
├── src/
│   ├── server.ts                     ← Bun.serve + hono app
│   ├── routes/
│   │   ├── checkout.ts
│   │   └── health.ts
│   ├── domain/
│   │   ├── checkout.ts
│   │   └── fraud.ts
│   ├── store/
│   │   ├── pool.ts                   ← postgres connection pool
│   │   └── orders.ts
│   ├── tax.ts
│   ├── observability/
│   │   ├── metrics.ts                ← prom-client
│   │   └── tracing.ts                ← @opentelemetry/sdk-node (works with Bun)
│   └── config.ts
├── Dockerfile
├── package.json
├── tsconfig.json
└── bun.lockb
```

### Key dependencies

- `hono`
- `postgres` (the `postgres` package, faster than `pg` for Bun)
- `@opentelemetry/api` + `@opentelemetry/sdk-node`
- `prom-client`
- `pino` (structured logging)

### Database

`postgres` package, `max: 20` for the pool. As of Bun 1.1+, this driver works well; if it doesn't, fall back to `pg`.

### Concurrency model

Single event loop. Bun's HTTP server is faster than Node's at the per-request level due to lower syscall overhead and a faster JSON parser.

### Gotchas

- **Bun's npm compatibility** is good but not perfect. Test every dep before committing.
- **OpenTelemetry SDK** has known issues on Bun for some auto-instrumentations. Stick to manual instrumentation for HTTP and DB spans.
- **`process.env`** is fast in Bun; **`Bun.env`** is faster but Bun-specific. Use `process.env` for portability.
- **Watch mode in dev** (`bun --watch`) restarts on every change, which is fast but resets the DB pool. For dev, prefer `bun --hot`.

### Dockerfile

```dockerfile
FROM oven/bun:1.1 AS build
WORKDIR /src
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .

FROM oven/bun:1.1-distroless
COPY --from=build /src /app
WORKDIR /app
USER nonroot:nonroot
ENTRYPOINT ["bun", "run", "src/server.ts"]
```

Final image: ~70MB.

---

## 04 — Node

### Framework choice: express

`express` is the realistic baseline. It's not the fastest Node framework (`fastify` would be), but it's what the largest fraction of Node services in production actually run. Picking `fastify` to win the benchmark would be honest only if a sentence said "we picked the fastest available framework"; we want to test "what most teams ship."

Alternative considered: `fastify`. We'll mention it in the case study and even include a `fastify` build as a footnote runtime someday — but it doesn't displace `express` in v1.

### Project structure

```
apps/backends/node/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── checkout.ts
│   │   └── health.ts
│   ├── domain/
│   │   ├── checkout.ts
│   │   └── fraud.ts
│   ├── store/
│   │   ├── pool.ts                   ← pg.Pool
│   │   └── orders.ts
│   ├── tax.ts
│   ├── observability/
│   │   ├── metrics.ts
│   │   └── tracing.ts
│   └── config.ts
├── Dockerfile
├── package.json
├── tsconfig.json
└── package-lock.json
```

### Key dependencies

- `express`
- `pg` (the canonical Node Postgres driver)
- `@opentelemetry/sdk-node` + auto-instrumentations
- `prom-client`
- `pino`

### Database

`pg.Pool({ max: 20 })`. `pg` has a connection pool built in; no need for a separate package.

### Concurrency model

Single event loop, single process. Node clustering would require multiple processes (and corresponding worker count adjustments) — we deliberately stay single-process to keep the comparison clean.

### Gotchas

- **`express` middleware order matters.** Body parser before routes. Logger before body parser if you want to log raw bodies. Error handler last.
- **`pg`'s default behavior parses BIGINT to string.** Set `pg.types.setTypeParser(20, parseInt)` if you want numbers, or just use the string form.
- **Async error handling in Express** is a footgun. Wrap all async handlers in a higher-order function that forwards to `next(err)`, or upgrade to Express 5 (which handles it natively).
- **Avoid `body-parser` if you don't need it.** `express.json()` is built in and works.

### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12
COPY --from=build /src/dist /app
COPY --from=build /src/node_modules /app/node_modules
WORKDIR /app
USER nonroot:nonroot
CMD ["server.js"]
```

Final image: ~85MB.

---

## 05 — Python

### Framework choice: fastapi + uvicorn

`fastapi` is the dominant async Python web framework. It's what data-org and ML-org Python services use today. With `uvicorn` as the ASGI server, this is a near-universal production setup.

Alternative considered: `litestar` (faster), `flask` (synchronous, slower). `fastapi` is the realistic middle.

### Project structure

```
apps/backends/python/
├── app/
│   ├── __init__.py
│   ├── main.py                       ← FastAPI app, uvicorn entrypoint
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── checkout.py
│   │   └── health.py
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── checkout.py
│   │   └── fraud.py
│   ├── store/
│   │   ├── __init__.py
│   │   ├── pool.py                   ← asyncpg pool
│   │   └── orders.py
│   ├── tax.py                        ← httpx client
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── metrics.py                ← prometheus_client
│   │   └── tracing.py
│   └── config.py
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

### Key dependencies

- `fastapi`
- `uvicorn[standard]`
- `asyncpg` (faster than psycopg3 for async)
- `httpx` (async HTTP client)
- `opentelemetry-api` + `opentelemetry-instrumentation-fastapi` + `opentelemetry-instrumentation-asyncpg`
- `prometheus-client`
- `structlog`

### Database

`asyncpg` is the fastest Python Postgres driver. Pool of 20 connections (`min_size=5, max_size=20`).

### Concurrency model

ASGI async with `uvicorn`. Workers: 4 (this is a fairness compromise, called out in METHODOLOGY).

Run with:
```
uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 4 --loop uvloop
```

### Gotchas

- **`uvloop`** matters. It's noticeably faster than the default asyncio loop. Install via `uvicorn[standard]` which pulls it in.
- **Pydantic v2** is much faster than v1. Make sure you're on v2.
- **GIL is a real constraint** for CPU-bound work. The fraud function (50ms of SHA work) WILL serialize across requests on a single worker. This is one reason we run 4 workers.
- **`asyncpg` and Pydantic** don't play together perfectly. Use `Record` directly or convert manually; don't try to validate result rows with Pydantic in the hot path.
- **Cold start** with all the imports is real (1-2s). Mitigate by using lazy imports for non-critical modules.

### Dockerfile

```dockerfile
FROM python:3.12-slim AS build
RUN pip install uv
WORKDIR /src
COPY pyproject.toml uv.lock ./
RUN uv export --no-dev --format requirements-txt > requirements.txt
RUN pip install --target /deps -r requirements.txt
COPY . .

FROM gcr.io/distroless/python3-debian12
ENV PYTHONPATH=/deps
COPY --from=build /deps /deps
COPY --from=build /src/app /app
WORKDIR /
USER nonroot:nonroot
ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]
```

Final image: ~120MB.

---

## 06 — PHP

### Framework choice: laravel + octane (RoadRunner)

`laravel` is the dominant PHP web framework. By default it's process-per-request, which would be a strawman. `octane` keeps the framework in memory between requests using a long-running worker (RoadRunner under the hood), which is how production Laravel ships in 2024+.

Alternative considered: `symfony` with similar runtime. Laravel + Octane is more popular and the comparison is more honest.

### Project structure

A standard Laravel layout:

```
apps/backends/php/
├── app/
│   ├── Domain/
│   │   ├── Checkout.php
│   │   └── Fraud.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── CheckoutController.php
│   │   │   └── HealthController.php
│   │   └── Middleware/
│   │       └── ObservabilityMiddleware.php
│   ├── Store/
│   │   ├── OrderRepository.php
│   │   └── ProductRepository.php
│   └── Tax/
│       └── TaxClient.php
├── config/
├── database/migrations/
├── routes/
│   └── api.php
├── public/
│   └── index.php
├── Dockerfile
├── composer.json
└── composer.lock
```

### Key dependencies

- `laravel/framework`
- `laravel/octane`
- `spiral/roadrunner`
- `open-telemetry/sdk` + `opentelemetry-auto-laravel`
- `promphp/prometheus_client_php`

### Database

PHP-PDO with the `pgsql` driver, accessed through Laravel's Eloquent (or raw query builder for hot paths). Octane workers each have their own connection pool. With 4 workers and 5 connections each, that's 20 total — matching the methodology rule.

### Concurrency model

4 RoadRunner workers, each handling requests serially (PHP doesn't have first-class async). 4 workers = 4 concurrent requests at any moment.

### Gotchas

- **Octane is essential.** Without it, PHP boots Laravel for every request and the numbers will be a strawman.
- **Memory leaks across requests are real.** Octane recycles workers after N requests (default 500). Configure carefully.
- **Eloquent vs raw queries.** Eloquent is convenient but adds 1-3ms of overhead per query. For the hot path, use the query builder directly.
- **OpenTelemetry for PHP** is less mature than other languages. Auto-instrumentation works but has gaps. Manual instrumentation for the spans we care about is safer.
- **JIT.** PHP 8.3 has a JIT but it's off by default. Turn it on (`opcache.jit=tracing`, `opcache.jit_buffer_size=100M`).

### Dockerfile

```dockerfile
FROM php:8.3-cli-alpine AS build
RUN apk add --no-cache postgresql-dev linux-headers \
 && docker-php-ext-install pdo pdo_pgsql opcache
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /src
COPY composer.* ./
RUN composer install --no-dev --no-scripts --optimize-autoloader
COPY . .
RUN composer install --no-dev --optimize-autoloader

FROM php:8.3-cli-alpine
RUN apk add --no-cache postgresql-libs \
 && docker-php-ext-install pdo pdo_pgsql opcache
COPY php.ini /usr/local/etc/php/conf.d/zz-bakeoff.ini
COPY --from=build /src /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["php", "artisan", "octane:start", "--server=roadrunner", "--host=0.0.0.0", "--port=8080", "--workers=4"]
```

A `php.ini` snippet enables JIT and opcache. Final image: ~95MB.

---

## Comparison summary table

| Runtime | Framework | Driver | HTTP server | Workers | Container size |
|---|---|---|---|---|---|
| Go | chi | pgx | net/http | 1 process / N goroutines | ~15MB |
| Rust | axum | sqlx | hyper (via axum) | 1 process / 2 tokio threads | ~25MB |
| Bun | hono | postgres | Bun.serve | 1 process / 1 event loop | ~70MB |
| Node | express | pg | http | 1 process / 1 event loop | ~85MB |
| Python | fastapi | asyncpg | uvicorn | 4 worker processes | ~120MB |
| PHP | laravel-octane | PDO+pgsql | RoadRunner | 4 worker processes | ~95MB |

These rows ARE the surface of the comparison. They're also the answer to "what changes when you flip the tab" — and the methodology rules are the answer to "what doesn't."

---

## Common patterns across all backends

### Request handler shape

Every backend's checkout handler follows this shape:

```pseudo
function checkout(request):
    span = trace.start("checkout")
    request_id = request.headers["x-request-id"] or generate()
    
    payload = parse_json(request.body)
    if not validate(payload):
        return 400
    
    products = db.query("SELECT id, sku, price_cents, stock FROM products WHERE id = ANY(...)", payload.cart_ids)
    if not products_match_cart(products, payload.cart):
        return 422
    
    tax = tax_client.compute(products, payload.shipping_address)
    fraud_score = compute_fraud(payload)  // ~50ms CPU
    
    order_id = db.transaction:
        insert into orders
        insert into order_items
    
    return 201 with order details
```

The methodology document specifies that this shape must be identical across runtimes. The contract conformance test verifies this empirically.

### Health endpoint

```pseudo
function health():
    if db.ping() succeeds:
        return 200 with {"status": "ok", "runtime": RUNTIME_NAME}
    else:
        return 503 with {"status": "degraded", "runtime": RUNTIME_NAME}
```

### Metrics setup

Every backend exposes the same Prometheus metrics. The label naming is shared. The histograms have identical buckets. This is enforced by the contract tests, not just convention.

---

## v0 vs v1 scope

If the budget for the project is tight, ship in two phases:

### v0 (3 backends)

- Go, Rust, Node
- Two extreme ends and the realistic middle
- Lower cluster cost (~$120/month instead of $230)
- Faster to ship — all three are well-trodden

### v1 (full 6)

- Add Bun (the new entrant)
- Add Python (representation for ML/data shops)
- Add PHP (the surprise)
- Cluster cost: ~$230/month

The v0 case study is already a strong portfolio piece. v1 is what makes it stand out from "another framework benchmark blog post."
