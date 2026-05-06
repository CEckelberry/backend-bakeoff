# Tasks

Phased build plan for Backend Bake-off. Same shape as the portfolio's TASKS.md — self-contained tasks with goal, inputs, outputs, and acceptance criteria. Hand them to Claude Code one at a time.

**Reference docs.** Pin `README.md`, `METHODOLOGY.md`, `ARCHITECTURE.md`, and `RUNTIMES.md` in the Claude Code context. The task being worked on is the only file that should change between sessions. `DESIGN.md` is needed for the frontend tasks (Phase 4+) only.

**Critical rule for backend tasks.** Every backend implementation task must satisfy `METHODOLOGY.md` rules. Don't shortcut them to ship faster — the project's credibility hinges on them. If a methodology rule is wrong, change `METHODOLOGY.md` first, then update the implementation.

**Estimated build time.** v0 (Go + Rust + Node only): ~7 weeks of evening-and-weekend work. v1 (all 6 backends): ~11-13 weeks. The frontend, infra (with wake-up cluster), and per-backend phases are the longest single-phase items.

---

## Phase overview

- **Phase 0 — Foundation** (1 week): repo, contract, infra skeleton, CI scaffold
- **Phase 1 — First backend** (1 week): Go backend end-to-end, the template for all others
- **Phase 2 — Infra + wake-up cluster** (2 weeks): GKE, Cloud SQL, observability, deploy pipeline, wake-up controller, idle watcher, budget cap
- **Phase 3 — Remaining backends v0** (2 weeks): Rust + Node, contract conformance, methodology audit
- **Phase 4 — Frontend v0** (2.5 weeks): basic site with live chart, runtime selector, place-an-order, warmup splash
- **Phase 5 — Stress + comparison modes** (1 week): the loadgen service, stress UI, comparison UI
- **Phase 6 — Polish + case study** (1 week): perf, accessibility, write the case study, deploy
- **Phase 7 — v1: Bun, Python, PHP** (3 weeks): adding the remaining three runtimes
- **Phase 8 — v2 stretch** (open): historical mode, more workloads, multi-region

Total time-to-launch for v0 (3 backends): ~7 weeks. v1 (all 6): ~11-13 weeks.

---

# Phase 0 — Foundation

Goal: a working monorepo with the OpenAPI contract defined, the methodology rules captured in CI scaffolding, and a docker-compose that brings up an empty cluster of placeholder services for local development.

- [ ] Task 0.1 — Monorepo scaffold
- [ ] Task 0.2 — OpenAPI contract
- [ ] Task 0.3 — Seed data + database schema
- [ ] Task 0.4 — Local dev compose
- [ ] Task 0.5 — CI scaffold
- [ ] Task 0.6 — Methodology audit script

---

## Task 0.1 — Monorepo scaffold

**Goal.** Create the repository structure described in `README.md` with the root tooling and empty placeholders for each app and infra directory.

**Outputs.**
- `pnpm-workspace.yaml` declaring `apps/web`, `apps/router`, `apps/loadgen`, `apps/backends/*`, `packages/*`
- `package.json` at the root with workspace scripts
- `Makefile` with stubs for `make dev`, `make build`, `make test`, `make bench`
- `.gitignore`, `.editorconfig`, `LICENSE` (MIT)
- Empty directory tree per `README.md`'s layout

**Acceptance criteria.**
- `pnpm install` runs cleanly at the root
- `make dev` exists (even if it just prints "not yet implemented")
- The directory tree matches `README.md` exactly

---

## Task 0.2 — OpenAPI contract

**Goal.** Define the canonical API contract that every backend must implement. This file is the source of truth — server stubs are generated from it, the contract conformance test reads it.

**Inputs.**
- `METHODOLOGY.md` (the Workload definition section)

**Outputs.**
- `api/openapi.yaml` with:
  - `POST /checkout` with full request and response schemas
  - `GET /health` with response schema
  - All shared types defined in `components/schemas`
  - Examples for valid orders, malformed requests, edge cases (empty cart, oversized cart, invalid product)
- `api/README.md` explaining how to use the spec to generate server stubs in each language
- A `make contract` target that lints the OpenAPI file via `redocly` or `spectral`

**Acceptance criteria.**
- The OpenAPI file passes `redocly lint` with zero errors and zero warnings
- All response codes used by any backend are documented (200, 201, 400, 422, 429, 500, 503)
- All schemas have descriptions and examples
- A small generator script in `api/generate.sh` produces server stubs for at least Go and TypeScript (proves the codegen works end-to-end)

---

## Task 0.3 — Seed data and database schema

**Goal.** A canonical product catalog (~200 products) and the DDL for `products`, `orders`, `order_items` tables. One schema per backend with identical structure.

**Inputs.**
- `METHODOLOGY.md` (the Database section)
- `ARCHITECTURE.md` (the Database section)

**Outputs.**
- `packages/seed-data/products.json` — 200 products with realistic shape (id, sku, name, price_cents, stock, created_at)
- `packages/seed-data/migrations/001_init.sql`:
  - Creates 6 schemas: `bakeoff_go`, `bakeoff_rust`, `bakeoff_bun`, `bakeoff_node`, `bakeoff_python`, `bakeoff_php`
  - Creates `products`, `orders`, `order_items` in each schema with identical DDL
  - Indexes on `orders.created_at`, `order_items.order_id`
  - Targets Postgres 18 (uses `gen_random_uuid()`, `JSONB` if needed, modern syntax)
- `packages/seed-data/migrations/002_seed.sql` — inserts the products catalog into all 6 schemas (each schema gets a copy)
- `packages/seed-data/seed.sh` — a script that runs the migrations against `$DATABASE_URL`

**Acceptance criteria.**
- Running `bash packages/seed-data/seed.sh` against a local Postgres successfully creates all 6 schemas with seed data
- `SELECT count(*) FROM bakeoff_go.products` returns 200, same for all 6 schemas
- DDL is byte-for-byte identical across schemas (verify with a diff script)
- `migrate up` and `migrate down` both work (use `golang-migrate` semantics)

---

## Task 0.4 — Local dev compose

**Goal.** A `docker-compose.yml` that brings up Postgres, the tax service, and placeholder backends so the rest of the monorepo can develop against a realistic local environment before any infra is deployed.

**Outputs.**
- `docker-compose.yml` at the root with services:
  - `db` — `postgres:18-alpine`, exposed on 5432, with volume
  - `db-init` — a one-shot job that runs the migrations from `packages/seed-data/`
  - `tax-service` — placeholder Go service that returns hard-coded tax (full implementation in Phase 1)
  - `bo-go`, `bo-rust`, `bo-bun`, `bo-node`, `bo-python`, `bo-php` — placeholders that just return 200 on `/health`
  - `prometheus` — `prom/prometheus:latest`, configured to scrape backends + tax + router
  - `grafana` — `grafana/grafana:latest`, with a single dashboard
  - `router` — placeholder Go service
- `infra/observability/prometheus-local.yml` — Prometheus scrape config for the local cluster
- `infra/observability/grafana/dashboards/local.json` — minimal dashboard
- A `make dev` Makefile target that runs `docker compose up --build`
- A `make dev-clean` target that runs `docker compose down -v`

**Acceptance criteria.**
- `make dev` brings everything up cleanly
- All 6 backend placeholders are reachable on their respective ports (8081-8086 mapped externally)
- Prometheus is reachable at localhost:9090 and shows all targets as UP
- Grafana is reachable at localhost:3001
- `make dev-clean` removes everything including volumes

---

## Task 0.5 — CI scaffold

**Goal.** A GitHub Actions workflow that runs on every push: detects which apps changed, runs lint and tests for each, fails fast.

**Outputs.**
- `.github/workflows/ci.yml`:
  - `paths-filter` step that detects changes per app
  - Conditional jobs that only run if their app changed
  - A baseline job that always runs OpenAPI linting and methodology audit
- `.github/workflows/README.md` documenting the secrets the workflow expects (filled in during Phase 2)

**Acceptance criteria.**
- A push touching only `apps/backends/go/` runs only the Go job (and the baseline)
- A push touching `api/openapi.yaml` runs all backend jobs (the contract changed)
- The workflow file passes `actionlint`

---

## Task 0.6 — Methodology audit script

**Goal.** A script that validates the resource specs and configuration in each backend's deployment manifest match the canonical methodology. Runs in CI; fails the build on any drift.

**Inputs.**
- `METHODOLOGY.md` (the "What we hold constant" section — every locked-down value)

**Outputs.**
- `scripts/audit-methodology.sh` (or `.go`, language doesn't matter as long as it runs in CI) that checks:
  - Every backend's Helm values has `cpu: 2000m`, `memory: 1024Mi`, `replicas: 1`
  - No backend overrides connection pool size != 20
  - No backend has HPA enabled
  - Worker count matches the rule (1 for Go/Rust/Bun/Node, 4 for Python/PHP)
  - Every backend exports the same Prometheus metric names
- A test harness `scripts/audit-test/` with deliberately-broken example manifests that the audit must reject
- A CI step in `.github/workflows/ci.yml` that runs the audit

**Acceptance criteria.**
- The audit passes on the placeholder manifests (which match the spec)
- The audit fails (with a clear error message) on each of the broken examples
- A small README explains how to extend the audit when adding a new methodology rule

---

# Phase 1 — First backend

Goal: the Go backend is fully implemented end-to-end against the local compose. It's the template for all five other implementations. By the end of this phase, you can fire `POST /checkout` against the local Go backend and get a working order, with metrics flowing into Prometheus and traces flowing into a local Jaeger or OTel Collector.

- [ ] Task 1.1 — Tax service (real implementation)
- [ ] Task 1.2 — Go backend skeleton
- [ ] Task 1.3 — Go: domain logic + database
- [ ] Task 1.4 — Go: tax client + fraud function
- [ ] Task 1.5 — Go: observability (metrics, traces, logs)
- [ ] Task 1.6 — Contract conformance test for Go
- [ ] Task 1.7 — Router service

---

## Task 1.1 — Tax service

**Goal.** The shared tax service that all backends call. ~50 lines of Go that returns a fake tax computation after a uniformly-random 5–15ms sleep.

**Inputs.**
- `METHODOLOGY.md` (the Tax service section)

**Outputs.**
- `apps/tax-service/cmd/server/main.go`
- `apps/tax-service/internal/handlers/tax.go` — handler for `POST /tax`
- `apps/tax-service/Dockerfile` — distroless static, ~15MB
- `apps/tax-service/openapi.yaml` — its own contract for the tax interface
- Minimal Prometheus metrics: total requests, request duration histogram

**Acceptance criteria.**
- `curl -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:8087/tax` returns 200 with a tax amount
- Response time is in the 5-15ms range (verify with 100 requests, all should be in that band)
- Container size is under 20MB
- Prometheus metrics are exported at `/metrics`

---

## Task 1.2 — Go backend skeleton

**Goal.** The Go backend's structure laid out per `RUNTIMES.md`, with `chi` wired up, `pgxpool` connected, the health endpoint working, but no business logic yet.

**Inputs.**
- `RUNTIMES.md` (the Go section)
- `ARCHITECTURE.md` (cross-runtime requirements)

**Outputs.**
- `apps/backends/go/cmd/server/main.go` with graceful shutdown
- `apps/backends/go/internal/http/router.go` with chi setup and middleware chain (request ID, recoverer, OTel http instrumentation)
- `apps/backends/go/internal/store/postgres.go` with pgxpool init
- `apps/backends/go/internal/http/handlers/health.go`
- `apps/backends/go/internal/config/config.go`
- `apps/backends/go/Dockerfile` per `RUNTIMES.md`

**Acceptance criteria.**
- `make dev-bo-go` starts the Go backend (it talks to the local Postgres from compose)
- `curl localhost:8081/health` returns 200 with `{"status":"ok","runtime":"go"}`
- Container size under 20MB
- Graceful shutdown works (SIGINT shuts down within 1s)

---

## Task 1.3 — Go: domain logic + database

**Goal.** Implement `POST /checkout` in Go: parse, validate, query products, persist order. No tax service call yet, no fraud function — just the database round-trips.

**Outputs.**
- `apps/backends/go/internal/domain/checkout.go` — pure business logic, no HTTP, no DB
- `apps/backends/go/internal/store/orders.go` — `InsertOrder`, `InsertOrderItems`, both in a transaction
- `apps/backends/go/internal/store/products.go` — `GetProductsByIDs`
- `apps/backends/go/internal/http/handlers/checkout.go` — wire it all together
- Unit tests for `domain/checkout.go` (no DB, pure logic)
- Integration tests for `store/orders.go` against a test Postgres

**Acceptance criteria.**
- `curl -X POST localhost:8081/checkout -d @example.json` returns 201 with order details
- The order persists to `bakeoff_go.orders` (verify via `psql`)
- Malformed JSON returns 400; missing fields return 422
- Cart with > 8 items returns 400 (per OpenAPI spec)
- `go test ./...` passes

---

## Task 1.4 — Go: tax client + fraud function

**Goal.** Add the tax service call and the fraud-scoring CPU function to the Go checkout handler. Both should be timed; the trace breakdown should show each as a span.

**Inputs.**
- `METHODOLOGY.md` (the Fraud function section, and the workload sequence)

**Outputs.**
- `apps/backends/go/internal/tax/client.go` — HTTP client for the tax service, with OTel propagation
- `apps/backends/go/internal/domain/fraud.go` — the fraud_score function (10x SHA-256)
- Updates to the checkout handler to call both in the right order

**Acceptance criteria.**
- A successful checkout response now includes `tax_amount` from the tax service
- The fraud function runs in ~50ms (verify with `time.Since`)
- Trace context propagates: a request to `/checkout` produces a trace with the tax service call as a child span
- p95 of `/checkout` is in the 60-100ms range when run with 5 RPS baseline load (this is the target)

---

## Task 1.5 — Go: observability (metrics, traces, logs)

**Goal.** All three observability outputs from the Go backend match the canonical formats defined in `ARCHITECTURE.md`. Verified by hand against Prometheus, Cloud Trace (or local Jaeger for dev), and stdout JSON.

**Outputs.**
- `apps/backends/go/internal/observability/metrics.go` — Prometheus collectors with the canonical names from `ARCHITECTURE.md`
- `apps/backends/go/internal/observability/tracing.go` — OTel SDK init with OTLP exporter
- `apps/backends/go/internal/observability/logging.go` — slog with JSON handler
- All handlers and store methods have manual instrumentation where auto-instrumentation isn't enough

**Acceptance criteria.**
- `curl localhost:8081/metrics` returns Prometheus metrics with the canonical names
- A request to `/checkout` produces a trace in the OTel collector with all expected child spans (parse, db.query, tax.call, fraud.score, db.insert)
- Log lines on stdout are JSON with `runtime: "go"` set on every line
- Metric histogram buckets match `ARCHITECTURE.md`'s spec (1ms to 10s, with 5/10/25/50/100ms extras)

---

## Task 1.6 — Contract conformance test for Go

**Goal.** A test suite that fires a curated set of requests at the Go backend and asserts the responses match the OpenAPI contract exactly. This same suite will run against every other backend in subsequent phases.

**Outputs.**
- `tests/contract/` directory with:
  - `cases.json` — a list of (input, expected_status, expected_response_shape) triples
  - `run.sh` — runs the cases against `$BACKEND_URL`
  - `cases.yaml` versions of the same fixtures (OpenAPI spec validates them)
- A subset of cases:
  - Valid orders (3, 5, 8 items)
  - Empty cart → 422
  - 9-item cart → 400
  - Malformed JSON → 400
  - Missing required field → 422
  - Unknown product ID → 422
  - Out-of-stock product → 422
- A CI step that runs contract tests against the Go backend

**Acceptance criteria.**
- All cases pass against the Go backend
- The test fails if the response shape diverges from the OpenAPI spec
- The script exits non-zero on any failure
- A clear error message identifies which case failed and why

---

## Task 1.7 — Router service

**Goal.** The Go router service that fronts all backends. Reads `X-Runtime`, proxies to the matching backend, rate limits casual requests, has a stub for stress slot management.

**Inputs.**
- `ARCHITECTURE.md` (the Router section)

**Outputs.**
- `apps/router/cmd/server/main.go`
- `apps/router/internal/http/router.go` — chi setup
- `apps/router/internal/proxy/proxy.go` — the X-Runtime → backend logic
- `apps/router/internal/ratelimit/limiter.go` — token bucket per IP
- `apps/router/internal/stress/slot.go` — stub for the global stress slot (full impl in Phase 5)
- `apps/router/Dockerfile`

**Acceptance criteria.**
- `curl -H 'X-Runtime: go' localhost:8090/api/checkout -d @example.json` proxies to bo-go and returns the same response
- Sending an unknown runtime defaults to Go (per the design)
- 60+ rapid requests from the same IP get rate-limited (429 returned)
- Container size under 20MB

---

# Phase 2 — Infrastructure

Goal: GKE cluster, Cloud SQL, observability stack, and CI/CD all in place. The Go backend deploys to GKE on every push to main and is reachable at a public URL.

- [ ] Task 2.1 — Terraform: VPC, GKE, Cloud SQL
- [ ] Task 2.2 — Terraform: IAM, Workload Identity, Artifact Registry
- [ ] Task 2.3 — Helm chart for backends
- [ ] Task 2.4 — In-cluster observability (Prometheus, Grafana, OTel Collector)
- [ ] Task 2.5 — Cloud Run for frontend, router, loadgen
- [ ] Task 2.6 — CI: build and deploy backends in parallel
- [ ] Task 2.7 — First end-to-end deploy
- [ ] Task 2.8 — Wake-up controller (Cloud Function)
- [ ] Task 2.9 — Idle watcher + sleep choreography
- [ ] Task 2.10 — Budget cap automation

---

## Task 2.1 — Terraform: VPC, GKE, Cloud SQL

**Goal.** The base infrastructure: a VPC, a GKE Autopilot cluster, a Cloud SQL Postgres instance with private IP. Provisioned via Terraform with state in a GCS bucket.

**Inputs.**
- `ARCHITECTURE.md` (the Network and security, Backends, Database sections)

**Outputs.**
- `infra/terraform/main.tf` — provider, GCS backend
- `infra/terraform/variables.tf`
- `infra/terraform/network.tf` — VPC, subnet, Cloud Router for egress
- `infra/terraform/gke.tf` — Autopilot cluster, private nodes, public endpoint via authorized networks
- `infra/terraform/cloud_sql.tf` — `db-custom-1-3840` Postgres 18, private IP only, automated backups
- `infra/terraform/dns.tf` — managed zone for `bakeoff.ce.dev`
- `infra/terraform/README.md` — bootstrap instructions

**Acceptance criteria.**
- `terraform init && terraform plan` succeeds without errors
- `terraform apply` provisions all resources
- A `kubectl get nodes` succeeds against the new cluster (after `gcloud container clusters get-credentials`)
- `psql $DATABASE_URL` connects from a Cloud Shell VM in the same VPC

---

## Task 2.2 — Terraform: IAM, Workload Identity, Artifact Registry

**Goal.** The security and CI/CD glue: per-backend service accounts, Workload Identity Federation for GitHub Actions, Artifact Registry for container images.

**Outputs.**
- `infra/terraform/iam.tf` — 6 backend service accounts, the tax-service account, the loadgen account, the WIF pool and provider for GitHub Actions
- `infra/terraform/artifact_registry.tf` — single Docker repo `bakeoff` for all images
- `infra/terraform/secrets.tf` — Secret Manager entries for DB passwords, with random_password generation
- IAM bindings for each service account: only what it needs, nothing more

**Acceptance criteria.**
- `gcloud iam service-accounts list` shows all 8 service accounts
- A test GitHub Actions workflow can authenticate via WIF and push a test image to Artifact Registry
- DB passwords are stored in Secret Manager, not in Terraform state

---

## Task 2.3 — Helm chart for backends

**Goal.** A single Helm chart that templates a backend deployment with the methodology-locked values, plus per-runtime override files.

**Inputs.**
- `METHODOLOGY.md` (the locked-down values)
- `ARCHITECTURE.md` (the Helm chart structure section)

**Outputs.**
- `infra/k8s/charts/bakeoff/Chart.yaml`
- `infra/k8s/charts/bakeoff/values.yaml` — default values: 2000m CPU, 1024Mi mem, 1 replica, etc.
- `infra/k8s/charts/bakeoff/templates/`:
  - `deployment.yaml` — Deployment with the canonical resource spec, methodology-locked
  - `service.yaml` — ClusterIP service named `bo-{{runtime}}`
  - `serviceaccount.yaml`
  - `servicemonitor.yaml` — for Prometheus Operator
- `infra/k8s/values/go.yaml` — Go-specific overrides (image, only)
- `infra/k8s/values/rust.yaml` — placeholder
- `infra/k8s/values/node.yaml` — placeholder

**Acceptance criteria.**
- `helm template bakeoff ./infra/k8s/charts/bakeoff -f ./infra/k8s/values/go.yaml` produces valid manifests
- `kubectl apply --dry-run=server` succeeds against the rendered manifests
- The methodology audit (Task 0.6) passes against the rendered manifests
- Trying to override CPU in `go.yaml` causes the audit to fail (verifies the audit is wired in)

---

## Task 2.4 — In-cluster observability

**Goal.** Prometheus, Grafana, and OpenTelemetry Collector all running in the cluster, scraping/receiving from all backends, with one production-quality dashboard live.

**Outputs.**
- Helm releases for:
  - `kube-prometheus-stack` (Prometheus + Grafana + Operator)
  - `opentelemetry-collector` (deployment mode)
- `infra/observability/values/prometheus.yaml` — scrape configs, storage retention (30 days)
- `infra/observability/values/otel-collector.yaml` — OTLP receivers, Cloud Trace exporter, tail sampling
- `infra/observability/values/grafana.yaml` — admin password from Secret Manager
- `infra/observability/dashboards/live-comparison.json` — the main dashboard with 6 lines of p95
- `infra/observability/dashboards/per-runtime.json` — drill-down per runtime
- `infra/observability/dashboards/cost-per-request.json` — derived from CPU usage

**Acceptance criteria.**
- All three Helm releases are healthy in the cluster
- Prometheus scrapes the deployed Go backend and shows its metrics
- Grafana is reachable (via port-forward) and shows the 3 dashboards with data
- A test trace from the Go backend reaches Cloud Trace
- Tail sampling works: errors and slow requests sampled at 100%, fast requests at ~10%

---

## Task 2.5 — Cloud Run for frontend, router, loadgen

**Goal.** Cloud Run service definitions for the three non-cluster apps, all behind a single Cloud Load Balancer with the apex domain.

**Outputs.**
- `infra/terraform/cloud_run.tf`:
  - Three services: `frontend`, `router`, `loadgen`
  - Each with the right service account
  - Serverless VPC connector for `router` and `loadgen` (need to reach the cluster + Cloud SQL)
  - `loadgen` has Cloud Scheduler trigger for the baseline workload
- `infra/terraform/load_balancer.tf` — Cloud LB routing `/api/*` → router, everything else → frontend
- `infra/terraform/dns.tf` updated to point apex at the LB

**Acceptance criteria.**
- All three Cloud Run services deploy successfully
- `https://bakeoff.ce.dev/` reaches the frontend (placeholder for now)
- `https://bakeoff.ce.dev/api/health` reaches the router
- The Cloud Scheduler triggers the loadgen Cloud Run job once a minute
- SSL certificate is valid (managed by GCP)

---

## Task 2.6 — CI: build and deploy backends in parallel

**Goal.** A push to main detects which apps changed, builds those containers in parallel, runs contract tests, deploys to GKE/Cloud Run, runs smoke tests.

**Outputs.**
- `.github/workflows/deploy.yml`:
  - Matrix job: build each changed backend in parallel
  - Pushes images to Artifact Registry
  - Deploys via `helm upgrade` (for backends) or `gcloud run deploy` (for Cloud Run apps)
  - Runs the contract test suite against the new revision
  - Runs the methodology audit
  - Smoke test: hits a few endpoints, verifies 200s
  - On failure: rollback via `helm rollback`
- A documentation update in `.github/workflows/README.md`

**Acceptance criteria.**
- A push that changes only `apps/backends/go/` triggers only the Go build and deploy
- A push that changes `api/openapi.yaml` triggers all backend builds (contract changed)
- A failed contract test rolls back the deploy and the previous revision continues serving
- The methodology audit failure also blocks the deploy

---

## Task 2.7 — First end-to-end deploy

**Goal.** The Go backend, tax service, router, and a placeholder frontend are all deployed and working in production. A real `curl` to `https://bakeoff.ce.dev/api/checkout?rt=go` succeeds.

**Outputs.**
- A `DEPLOY.md` documenting the deploy process and where logs live
- All previous Phase 0-2 artifacts confirmed working

**Acceptance criteria.**
- `curl -X POST -H "X-Runtime: go" https://bakeoff.ce.dev/api/checkout -d @example.json` returns 201
- The order shows up in Cloud SQL (verify via Cloud SQL Studio)
- The trace shows up in Cloud Trace
- Prometheus is scraping the Go backend successfully (verify in the in-cluster Grafana)
- Cost so far for 1 day of running: confirm it's in the expected range (~$3-5)

---

## Task 2.8 — Wake-up controller (Cloud Function)

**Goal.** A Cloud Function that wakes the GKE cluster on demand. Talks to the Kubernetes API to scale HPA min replicas from 0 to 1, watches for pod readiness, manages a state machine in Postgres, and exposes a status endpoint.

**Inputs.**
- `ARCHITECTURE.md` (the Wake-up orchestration section)
- `METHODOLOGY.md` (the priming window rules)

**Outputs.**
- `apps/wake-controller/cmd/function/main.go` — Cloud Function entry point
- `apps/wake-controller/internal/k8s/client.go` — Kubernetes client using in-cluster service account or service account JSON for the function
- `apps/wake-controller/internal/state/store.go` — Postgres state machine (table `cluster_state` with fields: `state`, `transitioned_at`, `triggered_by`)
- `apps/wake-controller/internal/orchestrator/wake.go` — wake sequence implementation
- HTTP endpoints exposed by the function:
  - `POST /wake` — initiates wake-up, returns immediately with current state and ETA
  - `GET /status` — returns current state, last transition time, per-backend pod readiness
  - `POST /sleep` — initiates sleep (called by idle watcher)
- Terraform updates to deploy the function with the right IAM (GKE cluster admin scoped to the cluster, Postgres write access via Secret Manager)
- A simulator for local dev that fakes the GKE API so the function can be tested without a real cluster

**State machine:**
- States: `asleep`, `waking`, `priming`, `awake`, `sleeping`, `failed`
- Transitions guarded by current state (e.g., a wake call when state is `waking` is a no-op)
- Each transition writes to Postgres with a timestamp

**Acceptance criteria.**
- `POST /wake` triggers a real cluster wake (verify with `kubectl get pods` going from 0 to 6)
- The state machine correctly tracks each phase
- A second `POST /wake` during waking is a no-op (verified by Postgres timestamp not advancing)
- Wake-up failure (simulated by killing a pod) reports `failed` state with an error message
- The function cold-starts in under 2 seconds (it's small Go, should be well under)
- A unit test of the orchestrator passes against the simulator

---

## Task 2.9 — Idle watcher + sleep choreography

**Goal.** The Cloud Scheduler job that periodically checks for idle and triggers sleep. Plus the daily 4am audit job that wakes briefly to run the methodology audit, then sleeps again.

**Inputs.**
- `ARCHITECTURE.md` (the Sleep sequence section)
- `METHODOLOGY.md` (the daily drift detection section)

**Outputs.**
- A Cloud Scheduler job `idle-watcher` that runs every 5 minutes:
  - Calls a new endpoint `GET /api/last-activity` on the router
  - If last activity > 15 minutes ago and state is `awake`, calls `POST /sleep` on the wake controller
- A Cloud Scheduler job `daily-audit` that runs at 4am UTC:
  - Calls `POST /wake` and waits for `awake` state
  - Triggers the audit replay (a separate Cloud Run job that runs the 1000-request sequence)
  - Records results to Postgres
  - Returns; the idle watcher will sleep the cluster 15 minutes later
- An `apps/router/internal/activity/tracker.go` — last-activity-time tracking (in-memory, since it doesn't need persistence)
- Updates to `apps/router/cmd/server/main.go` to register the activity tracker middleware

**Acceptance criteria.**
- Manually triggering the idle watcher when the cluster is awake but idle: cluster goes to sleep within ~3 minutes
- A visitor request resets the idle timer correctly
- The daily audit runs successfully and records results
- The audit run does not skew the metrics dashboard (its data is filtered out via a label)

---

## Task 2.10 — Budget cap automation

**Goal.** A hard $150/month spending cap enforced by a Cloud Function that responds to billing alerts. If breached, forces the cluster to sleep and disables the wake controller until manual reset.

**Outputs.**
- `apps/budget-cap/cmd/function/main.go` — Cloud Function triggered by Pub/Sub from billing alerts
- Logic:
  - On 50% alert ($75): log info, send notification email
  - On 90% alert ($135): log warning, send notification email
  - On 100% alert ($150): force sleep, set a `disabled` flag in Postgres that the wake controller checks
- An admin reset endpoint: `POST /admin/reset-cap` requires a one-time secret rotated via Secret Manager
- Status page integration: when disabled, the frontend shows "offline — cost cap reached" instead of the warmup splash
- Terraform: billing budget resource at $150 with three thresholds, Pub/Sub topic, Cloud Function subscription

**Acceptance criteria.**
- Manually firing a fake billing alert via gcloud at 100% triggers the auto-pause
- The wake controller refuses wake requests when the disabled flag is set
- Manual reset endpoint successfully clears the flag
- A test in the audit suite verifies the budget cap configuration matches the spec

---

# Phase 3 — Remaining v0 backends

Goal: Rust and Node implementations are complete, contract-conformant, and deployed alongside Go. The methodology audit passes. The contract tests pass against all three.

- [ ] Task 3.1 — Rust backend skeleton + observability
- [ ] Task 3.2 — Rust: domain logic, DB, tax, fraud
- [ ] Task 3.3 — Rust: contract conformance + deploy
- [ ] Task 3.4 — Node backend skeleton + observability
- [ ] Task 3.5 — Node: domain logic, DB, tax, fraud
- [ ] Task 3.6 — Node: contract conformance + deploy

---

## Task 3.1 — Rust backend skeleton + observability

**Goal.** Rust backend with `axum`, `sqlx`, `tracing`, OTel SDK, Prometheus crate. Health endpoint working, but no business logic.

**Inputs.** `RUNTIMES.md` (the Rust section)

**Outputs.**
- `apps/backends/rust/src/main.rs`, `src/http/`, `src/store/`, `src/observability/` per the structure in RUNTIMES.md
- `apps/backends/rust/Dockerfile` with `cargo-chef` for caching
- `Cargo.toml` with all dependencies pinned

**Acceptance criteria.**
- Container builds in under 5 minutes (cargo-chef caching working)
- Container size under 30MB
- `/health` returns 200 against local DB
- Prometheus metrics endpoint exports the canonical names
- Trace propagates correctly to OTel collector

---

## Task 3.2 — Rust: domain logic, DB, tax, fraud

**Goal.** Full implementation of `/checkout` in Rust matching the workload definition exactly.

**Outputs.**
- `apps/backends/rust/src/domain/`, `src/store/`, `src/tax.rs`, `src/domain/fraud.rs`
- `sqlx` queries with `query_as!` macros for compile-time validation
- The `fraud_score` function in Rust matching the algorithm
- Integration tests against a test Postgres

**Acceptance criteria.**
- A valid checkout request returns 201 with order details
- p95 latency in the 30-60ms range under 5 RPS baseline (Rust should be the fastest)
- The trace breakdown shows the same span structure as Go
- All `cargo test` and `cargo clippy` checks pass

---

## Task 3.3 — Rust: contract conformance + deploy

**Goal.** The contract test suite passes against the Rust backend. Deploy to GKE.

**Outputs.**
- `infra/k8s/values/rust.yaml` — image reference, anything else allowed to vary
- `tests/contract/run.sh` updated to test all 3 backends in matrix
- Verified deploy via CI

**Acceptance criteria.**
- All contract test cases pass for Rust
- Methodology audit passes for the Rust deployment
- The live Grafana dashboard shows both Go and Rust producing data
- The relative latency makes sense (Rust < Go in p95)

---

## Task 3.4 — Node backend skeleton + observability

**Goal.** Node backend with `express`, `pg`, OTel auto-instrumentation, Prometheus prom-client. Health endpoint working, no business logic.

**Inputs.** `RUNTIMES.md` (the Node section)

**Outputs.**
- `apps/backends/node/src/server.ts`, `src/routes/`, `src/store/`, `src/observability/`
- `apps/backends/node/Dockerfile` (distroless nodejs)
- `package.json` with all deps pinned
- TypeScript build configured

**Acceptance criteria.**
- Container size under 100MB
- `/health` works against local DB
- Prometheus metrics with canonical names
- Trace propagates to OTel collector
- `npm run lint` and `npm run typecheck` pass

---

## Task 3.5 — Node: domain logic, DB, tax, fraud

**Goal.** Full `/checkout` implementation in Node.

**Outputs.**
- All handler / store / domain code per RUNTIMES.md structure
- The `fraud_score` function in TypeScript using `crypto.createHash`
- Integration tests with `vitest` or `node --test`

**Acceptance criteria.**
- A valid checkout returns 201
- p95 latency in the 80-150ms range (Node should be slower than Go but faster than Python)
- Trace structure matches Go and Rust
- All tests pass

---

## Task 3.6 — Node: contract conformance + deploy

**Goal.** Contract tests pass against Node. Deploy to GKE.

**Outputs.**
- `infra/k8s/values/node.yaml`
- Contract tests passing in matrix
- Live data in Grafana for all 3 runtimes

**Acceptance criteria.**
- All contract test cases pass for Node
- Methodology audit passes
- Live dashboard shows all three runtimes producing distinct, sensible data
- Cost for the cluster running 3 backends + observability: confirm under $150/month

---

# Phase 4 — Frontend v0

Goal: The interactive site is live. Visitors can see the live latency chart, pick a runtime, place an order, and see the timing breakdown. Comparison and stress modes are not yet implemented.

- [ ] Task 4.1 — SvelteKit project + design tokens
- [ ] Task 4.2 — Layout shell + page structure
- [ ] Task 4.3 — Live metrics chart
- [ ] Task 4.4 — Runtime tabs
- [ ] Task 4.5 — Place-an-order panel
- [ ] Task 4.6 — Order result + timing breakdown
- [ ] Task 4.7 — Methodology badge + modal
- [ ] Task 4.8 — Mobile adaptations
- [ ] Task 4.9 — Warmup splash + wake-up gate

---

## Task 4.1 — SvelteKit project + design tokens

**Goal.** SvelteKit app initialized with Tailwind v4, all design tokens from the portfolio + the runtime accent colors wired up.

**Inputs.**
- `DESIGN.md`
- The portfolio's `DESIGN.md` (for inherited tokens)

**Outputs.**
- `apps/web/` SvelteKit project with TypeScript and Tailwind v4
- `apps/web/src/app.css` with full token system including `--rt-go`, `--rt-rust`, etc.
- Three font families loaded
- A placeholder home page that uses the tokens (verify they're working)

**Acceptance criteria.**
- `pnpm --filter web dev` works
- All 6 runtime accent colors render correctly via `var(--rt-go)` etc.
- Dark/light mode toggle (carried over from portfolio) works

---

## Task 4.2 — Layout shell + page structure

**Goal.** The page structure laid out per `DESIGN.md`'s page-structure diagram. Nav, hero, runtime selector area, comparison area, stress area, methodology footer.

**Outputs.**
- `apps/web/src/routes/+layout.svelte` — global shell, mesh background (carried from portfolio)
- `apps/web/src/routes/+page.svelte` — the main page with section placeholders
- `apps/web/src/lib/components/shell/Nav.svelte` — back to portfolio link, github link, case study link

**Acceptance criteria.**
- All five page sections render in the right order
- Each section is clearly identifiable in dev tools
- Nav links work (back to portfolio is a real link; github is a placeholder)

---

## Task 4.3 — Live metrics chart

**Goal.** The hero's chart: 6 runtime latency lines updating every 2 seconds from a fake-data source. Real data wiring comes in 4.4.

**Inputs.** `DESIGN.md` (the Live metrics panel section)

**Outputs.**
- `apps/web/src/lib/components/metrics/LiveChart.svelte` — Chart.js wrapper
- `apps/web/src/lib/components/metrics/MetricToggle.svelte` — p50/p95/p99/RPS/error toggle
- `apps/web/src/lib/data/fake-metrics.ts` — fake data source for development
- All states from `DESIGN.md`: warming up, stale data, elevated errors

**Acceptance criteria.**
- The chart renders 6 lines in the 6 runtime accent colors
- Lines update smoothly every 2s (no flashing, no jumps)
- The toggle switches between metrics correctly
- "Warming up" and "stale data" states are visible (toggle them in dev with a query param)
- The y-axis is log-scaled

---

## Task 4.4 — Runtime tabs + real data

**Goal.** The tabs that select which runtime serves the request. Active state persists in URL. Wire the chart to real Prometheus data via the router.

**Outputs.**
- `apps/web/src/lib/components/runtime/RuntimeTabs.svelte`
- `apps/web/src/lib/stores/runtime.ts` — writable store, syncs with URL
- `apps/web/src/lib/api/metrics.ts` — fetches `/api/metrics` from the router
- Updates to `LiveChart.svelte` to consume the real data

**Acceptance criteria.**
- All 6 tabs render with their accent colors
- Clicking a tab updates the URL and the active state
- The chart now shows real data from Prometheus (verify a placed order moves the line)
- A backend that's down shows as "unavailable" in its tab

---

## Task 4.5 — Place-an-order panel

**Goal.** The cart UI with 3-5 randomized items, the "place order" button, the request firing through the router with the active runtime header.

**Outputs.**
- `apps/web/src/lib/components/order/CartPanel.svelte`
- `apps/web/src/lib/components/order/PlaceOrderButton.svelte`
- `apps/web/src/lib/data/products.ts` — a subset of the seed catalog for display
- `apps/web/src/lib/api/checkout.ts` — fires `POST /api/checkout` with the right header

**Acceptance criteria.**
- Cart shows 3-5 realistic items with prices
- Clicking "place order" fires a real request
- Loading state shows during the request
- The request includes `X-Runtime` matching the active tab
- Errors are shown in a meaningful way (not "Object Object")

---

## Task 4.6 — Order result + timing breakdown

**Goal.** The result panel that fills after a successful order: order ID, total, the timing breakdown bars, the runtime that served, the trace ID with link.

**Outputs.**
- `apps/web/src/lib/components/order/ResultPanel.svelte`
- `apps/web/src/lib/components/order/TimingBars.svelte` — the horizontal bar breakdown
- `apps/web/src/lib/api/trace.ts` — fetches the trace details (or extracts from response headers)

**Acceptance criteria.**
- A successful order populates the result panel within 100ms of response
- The 6 timing bars sum to the total response time, in the runtime's accent color
- Each bar is labeled (validation, db.read, tax.call, fraud, db.write, total)
- The "view trace" link opens Cloud Trace at the right trace ID

---

## Task 4.7 — Methodology badge + modal

**Goal.** The small badge that opens the methodology summary. Engineers will click this; it's high-leverage despite being small.

**Outputs.**
- `apps/web/src/lib/components/methodology/Badge.svelte`
- `apps/web/src/lib/components/methodology/Modal.svelte` — opens on click, shows summary + links
- `apps/web/src/routes/methodology/+page.svelte` — full methodology rendered as a page (markdown → svelte via mdsvex)
- `packages/content/methodology.md` — the methodology content (or symlink to METHODOLOGY.md)

**Acceptance criteria.**
- Badge is visible near the hero title
- Clicking opens a modal with the 200-word summary and two links
- `/methodology` renders the full document with proper typography
- "Last verified" timestamp is real (from CI run metadata)

---

## Task 4.8 — Mobile adaptations

**Goal.** The site works on mobile. The 6-line chart shows 3 lines by default; comparison and stress are hidden; runtime tabs become a select.

**Outputs.**
- Updates to all components for the mobile breakpoint
- A small banner: "this site is best on desktop"
- A "show 3 of 6" mechanism on the chart

**Acceptance criteria.**
- Site is usable at 375px width
- All interactive elements are tappable (44px minimum touch target)
- The chart is readable; no overflow
- The banner only shows on mobile
- Comparison and stress sections are hidden under mobile breakpoint

---

## Task 4.9 — Warmup splash + wake-up gate

**Goal.** When the visitor arrives and the cluster is asleep, the warmup splash takes over the page until the cluster is fully awake. Honest, informative, on-brand.

**Inputs.**
- `DESIGN.md` (the Warmup splash component section)
- `ARCHITECTURE.md` (the Wake-up orchestration section)

**Outputs.**
- `apps/web/src/lib/components/warmup/Splash.svelte` — full-viewport overlay with the staged headings and progress
- `apps/web/src/lib/components/warmup/BackendStatus.svelte` — the 6-row mini-status panel showing each runtime's progress
- `apps/web/src/lib/stores/cluster-state.ts` — Svelte store that subscribes to wake-controller status (polls every 2s during waking, longer interval during awake/sleeping)
- `apps/web/src/lib/api/wake.ts` — calls `GET /api/wake-status`, `POST /api/wake`
- A wake-up gate in `+layout.svelte`: on first paint, checks state. If asleep, shows splash and triggers wake. If awake, proceeds.
- A failure state with a retry button
- A "cost cap reached" state with a friendly explainer (this maps to the budget cap from Task 2.10)

**State transitions to render:**
- `asleep` → "Cluster sleeping — waking up..."
- `waking` → "Provisioning nodes..." with progress bar
- `priming` → "Priming — N seconds remaining..."
- `awake` → splash fades over 600ms, live UI appears
- `failed` → "Wake-up failed" with retry button
- `disabled` → "Site temporarily offline — cost cap reached. Will return next month."

**Acceptance criteria.**
- Loading the site when the cluster is asleep shows the splash within 200ms
- The splash updates in real time as the cluster progresses through wake-up phases
- Each backend's individual status (Pending → Running → Ready → Primed) updates independently
- Once the cluster is awake, the splash fades smoothly into the live UI
- The retry button works when wake fails
- The "cost cap reached" state is reachable in dev via a query parameter for testing
- Lighthouse Performance on the splash itself is ≥ 90 (it's the first impression, has to be fast)
- Reduced-motion: the splash skips the fade animation and snaps to the live UI

---

# Phase 5 — Stress + comparison modes

Goal: The interactive features that make the site memorable. Loadgen, comparison side-by-side, stress mode with the slot mechanism.

- [ ] Task 5.1 — Loadgen service
- [ ] Task 5.2 — Stress slot mechanism in router
- [ ] Task 5.3 — Stress mode UI
- [ ] Task 5.4 — Comparison mode UI
- [ ] Task 5.5 — Daily quota + abuse prevention

---

## Task 5.1 — Loadgen service

**Goal.** A Go service that generates load. Two modes: baseline (5 RPS continuous, triggered every minute) and stress (variable RPS for up to 30s).

**Inputs.** `ARCHITECTURE.md` (the Loadgen section)

**Outputs.**
- `apps/loadgen/cmd/server/main.go`
- `apps/loadgen/internal/baseline/runner.go` — fires N RPS at all 6 backends for 60s
- `apps/loadgen/internal/stress/runner.go` — fires N RPS at one backend for D seconds
- `apps/loadgen/Dockerfile`
- Cloud Run job config + Cloud Scheduler binding

**Acceptance criteria.**
- A manual invocation of the baseline mode generates load against all backends (visible in Grafana)
- A manual stress invocation against one runtime spikes its line on the chart
- The baseline runs every minute via Cloud Scheduler
- Cost observed: the baseline alone is ~$3/month

---

## Task 5.2 — Stress slot mechanism in router

**Goal.** The global stress slot. Only one stress run can be in flight at a time. Queue depth visible to the requester.

**Outputs.**
- `apps/router/internal/stress/slot.go` — full implementation (replaces Phase 1 stub)
- `apps/router/internal/stress/queue.go` — queue with timeout
- New router endpoints: `POST /api/stress`, `GET /api/stress/status`

**Acceptance criteria.**
- One client can claim the slot; a second client gets queued
- A slot release happens automatically after the duration + 5s grace
- Queue depth is exposed and accurate
- Hard cap: a slot cannot be held for more than 60s, regardless of duration argument

---

## Task 5.3 — Stress mode UI

**Goal.** The stress mode panel: runtime selector, RPS slider, duration toggle, start button, live progress, summary.

**Outputs.**
- `apps/web/src/lib/components/stress/StressPanel.svelte`
- `apps/web/src/lib/components/stress/RpsSlider.svelte`
- `apps/web/src/lib/components/stress/StressProgress.svelte` — live progress display
- `apps/web/src/lib/components/stress/StressSummary.svelte` — post-run summary

**Acceptance criteria.**
- Slider goes 1-200 RPS
- Duration toggles 10s and 30s
- Starting a run shows "running... Ns remaining" with countdown
- During the run, the live chart zooms to the active runtime
- After the run, a summary card shows total requests, errors, p50/p95/p99
- If the slot is taken: shows "queue depth: N — wait ~Ms"

---

## Task 5.4 — Comparison mode UI

**Goal.** Pick two runtimes, fire one request to both, see the timing breakdown side-by-side with a diff.

**Outputs.**
- `apps/web/src/lib/components/comparison/ComparePanel.svelte`
- `apps/web/src/lib/components/comparison/CompareResult.svelte` — two ResultPanels side by side
- `apps/web/src/lib/api/compare.ts` — fires both requests concurrently

**Acceptance criteria.**
- Two runtime selectors render
- Clicking "compare" fires identical payloads to both runtimes
- Results appear side-by-side
- A diff line shows the delta ("Rust beat Node by 47ms")
- Both timing breakdowns visible

---

## Task 5.5 — Daily quota + abuse prevention

**Goal.** Hard caps that prevent the site from costing more than expected.

**Outputs.**
- Updates to `apps/loadgen/` and `apps/router/`:
  - Daily stress run counter (200/day max, displayed as a counter on the site)
  - Per-IP stress mode rate limit (1 per 5 minutes per IP)
  - Cost-based circuit breaker: if today's spend exceeds $20, stress mode is disabled
- `apps/web/src/lib/components/stress/QuotaBadge.svelte` — shows current day quota

**Acceptance criteria.**
- Quota counter is accurate
- A 201st run on the same day is rejected
- The counter resets at midnight UTC

---

# Phase 6 — Polish + case study

Goal: The site feels finished. Lighthouse 95+. Accessibility 100. Case study written. Public launch.

- [ ] Task 6.1 — Performance pass
- [ ] Task 6.2 — Accessibility pass
- [ ] Task 6.3 — SEO + Open Graph
- [ ] Task 6.4 — Write the case study
- [ ] Task 6.5 — Verify methodology audit timestamp wiring
- [ ] Task 6.6 — Public launch + monitoring

---

## Task 6.1 — Performance pass

**Goal.** Lighthouse Performance ≥ 95 on every page. Live chart updates don't cause layout shift. INP < 200ms.

**Outputs.**
- A Playwright perf script asserting budgets
- Bundle analysis and unused code removal
- Image optimization for any images on the site

**Acceptance criteria.**
- Lighthouse mobile: Performance ≥ 90, Best Practices ≥ 95
- Lighthouse desktop: Performance ≥ 95
- INP under 200ms for all interactions including stress run start
- No CLS during chart updates

---

## Task 6.2 — Accessibility pass

**Goal.** axe-core zero violations. Lighthouse Accessibility 100.

**Outputs.**
- Playwright + axe-core script
- Fixes for any violations
- Keyboard nav tested manually

**Acceptance criteria.**
- axe-core: 0 violations on every page
- Lighthouse Accessibility: 100
- Site fully usable with keyboard
- Live chart has an accessible alt-text summary updated each refresh

---

## Task 6.3 — SEO + Open Graph

**Goal.** Real metadata, Open Graph image generation, sitemap, robots.

**Outputs.**
- `apps/web/src/lib/components/shell/SEO.svelte`
- OG image generator showing live numbers (regenerated on deploy)
- `static/robots.txt`
- `apps/web/src/routes/sitemap.xml/+server.ts`

**Acceptance criteria.**
- Each page has unique title and description
- OG image previews correctly on Twitter/X, LinkedIn
- The OG image shows real recent latency numbers (not generic)

---

## Task 6.4 — Write the case study

**Goal.** A 2500-3500 word case study for the portfolio site that walks through the project's architecture, decisions, methodology, results, and lessons.

**Inputs.** `METHODOLOGY.md`, `ARCHITECTURE.md`, all the lived experience of building this

**Outputs.**
- `packages/content/case-studies/bakeoff.md` (in the portfolio site's repo, not this one)
- Diagrams: architecture, the routing trick, the methodology audit flow
- Annotated code excerpts: the router (the chi reverse proxy + header read)
- Decision section addressing: why GKE not Cloud Run, why these 6 runtimes, why these worker counts, why this workload
- Lessons section: what worked (OpenAPI as the truth, methodology audit in CI, six instead of three) and what didn't (Cloud SQL config gotchas, observability cardinality bombs, etc.)

**Acceptance criteria.**
- The case study reads as a piece of writing, not a checklist
- Voice matches the portfolio's voice and tone guidelines
- Methodology decisions are owned, not justified by appeals to authority
- The case study links to the live site, the GitHub repo, and the methodology doc

---

## Task 6.5 — Verify methodology audit timestamp wiring

**Goal.** The "last verified Nh ago" badge on the site is real and updates when CI runs.

**Outputs.**
- The audit script writes a timestamp to a file at the end of each successful run
- The frontend reads that file (via a `/api/methodology-status` endpoint) and renders the timestamp
- A staleness threshold: if no successful audit in 7 days, the badge turns yellow

**Acceptance criteria.**
- A push that triggers CI updates the timestamp
- A 7-day silence makes the badge yellow with "audit overdue"

---

## Task 6.6 — Public launch + monitoring

**Goal.** Site is live, monitored, and the portfolio links to it. Alerts fire if anything's wrong.

**Outputs.**
- Update the portfolio's project metadata to point at the live URL
- Replace the case-study placeholder with the live demo embed
- Cloud Monitoring alert policies:
  - Uptime check on the apex
  - Error rate > 5% for any runtime over 10 minutes
  - p95 > 1s for any runtime over 10 minutes
  - Cost > $300/month projected
- A `/status` page (or link to a public Cloud Status page) for transparency

**Acceptance criteria.**
- The live site is reachable from the portfolio
- All alerts have been verified by manually inducing each condition (then resolving)
- The status page reflects reality
- Initial Twitter/HN/Mastodon launch posts are queued (or sent if you're feeling brave)

---

# Phase 7 — v1: Bun, Python, PHP

Goal: Add the remaining three runtimes. Each follows the same pattern as Phase 3's Rust + Node tasks. The case study and methodology may need light updates to reflect the larger comparison.

- [ ] Task 7.1 — Bun backend (skeleton, full impl, contract, deploy)
- [ ] Task 7.2 — Python backend (skeleton, full impl, contract, deploy)
- [ ] Task 7.3 — PHP backend (skeleton, full impl, contract, deploy)
- [ ] Task 7.4 — Update methodology doc for v1 (worker count footnotes)
- [ ] Task 7.5 — Update case study with v1 findings

The structure of each "add a backend" task is identical to Phase 3 — skeleton + observability, then domain logic, then contract conformance, then deploy. Reuse those task templates.

---

# Phase 8 — v2 stretch ideas

Open-ended. None of these are required to launch — they're things that would extend the project in interesting directions later.

- **Historical mode**: replay a fixed sequence of 10K requests against each backend and persist the results. Show "this week vs last week" trends per runtime.
- **More workloads**: add a second endpoint (`/inventory/check`, a read-only lookup) and a third (`/orders/list`, a paginated read). Different workloads favor different runtimes; the comparison gets richer.
- **Multi-region**: deploy the cluster to two regions, show the cross-region latency cost.
- **Framework matrix**: alongside the language tabs, a "framework" toggle: Go with chi vs Go with gin; Node with express vs fastify. Combinatorial explosion is a real risk; ship cautiously.
- **Cost-per-request widget**: each runtime tab shows its $-per-million-requests based on observed CPU cost.
- **Failure injection**: a "chaos" toggle that randomly delays a backend's DB queries by 100ms; see how each runtime degrades under stress.
