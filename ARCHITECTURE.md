# Architecture

How the system is wired. The methodology rules in `METHODOLOGY.md` are the constraints; this document is how those constraints translate into infrastructure.

---

## System diagram

```
                          ┌─────────────────────────────┐
                          │  bakeoff.ce.dev             │
                          │  (Cloud DNS + Cloud LB)     │
                          └──────────────┬──────────────┘
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  │                                             │
                  ▼                                             ▼
    ┌──────────────────────────┐               ┌──────────────────────────┐
    │  Frontend (Cloud Run)    │               │  Router (Cloud Run)      │
    │  - SvelteKit             │   ── /api ──> │  - Go (chi)              │
    │  - Live charts           │               │  - Reads X-Runtime hdr   │
    │  - Comparison UI         │               │  - Proxies to GKE        │
    └──────────────────────────┘               │  - Rate limits           │
                                               │  - Stress mode broker    │
                                               └────────────┬─────────────┘
                                                            │
                                            (VPC-native HTTP, plaintext H1)
                                                            │
                                                            ▼
                            ┌──────────────────────────────────────────────┐
                            │  GKE Autopilot Cluster (us-west1)            │
                            │  Scales to zero after 15min idle             │
                            │                                              │
                            │  ┌─────────────────────────────────────┐    │
                            │  │  bakeoff namespace                   │    │
                            │  │                                       │    │
                            │  │  bo-go      ─────┐                   │    │
                            │  │  bo-rust    ─────┤                   │    │
                            │  │  bo-bun     ─────┤───┐               │    │
                            │  │  bo-node    ─────┤   │               │    │
                            │  │  bo-python  ─────┤   │               │    │
                            │  │  bo-php     ─────┘   │               │    │
                            │  │                       │               │    │
                            │  │  tax-service  <───────┤               │    │
                            │  │  loadgen      <───────┘               │    │
                            │  │                                       │    │
                            │  │  prometheus  (scrapes all of above)  │    │
                            │  │  grafana     (dashboards)            │    │
                            │  └───────────────────────────────────────┘   │
                            └────────────────┬─────────────────────────────┘
                                             │ (private IP, VPC-peered)
                                             ▼
                                ┌──────────────────────────┐
                                │  Cloud SQL Postgres 18   │
                                │  - db-custom-1-3840      │
                                │  - 6 isolated schemas    │
                                │  - Always running        │
                                │  - Private IP only       │
                                └──────────────────────────┘
```

---

## Components

### Frontend (Cloud Run)

A SvelteKit app served from Cloud Run. Static prerender for everything except the live data surfaces. Connects to the router for all API calls and to Prometheus (proxied via the router) for live metrics. Embeds a Grafana dashboard via iframe for the deeper dashboard view.

Why Cloud Run and not GKE: the frontend doesn't need to be co-located with the backends. Putting it in the same cluster would muddy the cost model and make local dev harder. Cloud Run is the right tool for stateless web frontends.

### Router (Cloud Run)

A small Go service. ~300 lines of code. Responsibilities:

- **Read `X-Runtime` header** on each request, look up the matching backend service, proxy via reverse proxy
- **Rate limit** by IP (60 RPM for casual orders, returns 429 above)
- **Mediate stress mode**: a single global slot, requests for the slot are queued, the loadgen service takes the slot when granted
- **Inject trace context**: ensures every request gets a `traceparent` header so traces from frontend to backend stitch together
- **Proxy `/api/metrics`**: pulls from Prometheus' HTTP API and shapes the response for the frontend's chart

The router runs on Cloud Run because it's stateless, scales-to-zero is fine, and putting it in GKE would add operational weight without benefit. The single bridge it has to the cluster is a Cloud Run-to-GKE private connection via Serverless VPC Connector.

### Loadgen (Cloud Run, scheduled)

A Go service that generates request load. Two modes:

- **Baseline**: a continuous 5 RPS against each backend, 24/7. Runs as a Cloud Run job triggered every minute by Cloud Scheduler. Each invocation fires for 60 seconds, then exits.
- **Stress**: triggered by a router request that's claimed the global stress slot. Fires up to 200 RPS against the chosen backend for up to 30 seconds. Tears down cleanly.

Why Cloud Run and not GKE: scales to zero between baseline runs. Spinning up a small container for 60 seconds every minute is cheaper than running it continuously.

### Backends (GKE Autopilot)

Six pods, one per runtime. Each pod:

- Runs as a Deployment with `replicas: 1`
- Has identical resource requests/limits (2000m CPU, 1024Mi memory)
- Has identical liveness/readiness probes (`GET /health`, 5s initial delay, 1s timeout)
- Is fronted by a `ClusterIP` Service named `bo-{runtime}`
- Sits behind a `PodAntiAffinity` rule that puts each on its own node (no co-tenancy)
- Connects to Cloud SQL via the private VPC connection
- Exports Prometheus metrics on `:9090/metrics`
- Exports OTLP traces to the in-cluster OpenTelemetry Collector

**Scaling behavior.** GKE Autopilot is configured to scale the node pool down to zero when there's no pending pod work for 15 minutes. When the wake-up controller (a Cloud Function) requests cluster expansion, Autopilot provisions nodes within 30-60s, then schedules the six backend pods + tax service on them. The scaling is driven by a `HorizontalPodAutoscaler` at the Deployment level (min: 0, max: 1) — when min is set to 1 by the wake-up controller, the pods come up; when set back to 0 after idle, they shut down.

**No co-tenancy under load.** Even under stress mode, each backend stays on its own node. Stress mode is the time when fairness matters most; co-tenancy would silently distort the comparison.

Why GKE and not Cloud Run: cold starts, scale-to-zero at the per-request granularity, and Cloud Run's per-request CPU model would all distort the benchmark. We need the pods always-on while the cluster is awake, on identical hardware, with no per-request cold-start variance. The whole-cluster wake-up (vs per-request cold-start) preserves the methodology — we measure only after the system is fully warm.

### Tax service (GKE)

A Go service in the same cluster, same namespace. Exposes `POST /tax` which sleeps a uniformly-random 5–15ms and returns a tax amount. It's deliberately simple — its job is to add realistic outbound-call latency to the workload, not to be interesting.

Single replica. Same resource profile as the backends. Failure of the tax service breaks all six backends equally, which is by design.

### Database (Cloud SQL)

A single Postgres 18 instance, `db-custom-1-3840` (1 vCPU, 3.75GB RAM). Private IP only, in the same VPC as GKE. Stays running when the cluster sleeps — the database is the project's persistent state and waking it cleanly from cold would add 10-15s to every cluster wake-up.

Six schemas, one per backend: `bakeoff_go`, `bakeoff_rust`, etc. Each schema has the same DDL: `products`, `orders`, `order_items`. The product catalog (~200 rows) is identical across schemas, seeded via a migration job at deploy time.

Each backend's connection string points to its own schema with `search_path` set. This isolates writes (no contention between backends) while keeping all six on the same physical instance (so the comparison is fair on storage I/O and CPU contention at the DB layer).

Connection pool: 20 connections per backend, configured at the application layer. No PgBouncer.

**Why not in-cluster Postgres?** Considered and rejected. Co-locating Postgres on a backend node would create methodology violations (one backend gets unfair latency to its DB). A dedicated Postgres node would cost roughly the same as Cloud SQL while adding operational burden (backups, upgrades, restarts during cluster wake-ups). Cloud SQL at $35/month is the cheap option once you account for what "free" actually costs.

### Observability stack (GKE)

In-cluster:

- **Prometheus** — scrapes all backends every 5 seconds, retains 30 days at 5s resolution. Configured with the recording rules needed for the live UI's 60-second windows.
- **Grafana** — three dashboards:
  - "Live comparison" — the same data the frontend chart shows, but with more knobs
  - "Per-runtime detail" — one runtime at a time, deeper drilldowns
  - "Cost per request" — derived from CPU usage + node cost
- **OpenTelemetry Collector** — receives traces from all backends, exports to Cloud Trace. Configured with tail-based sampling: keep 100% of slow requests (>500ms) and errors, sample 10% of fast requests.

Cloud-managed:

- **Cloud Trace** — trace storage and exploration, ~30-day retention
- **Cloud Logging** — receives stdout from all pods via the GKE log agent

---

## Wake-up orchestration

The cluster scales to zero when nobody's using the site. When a visitor lands, the system wakes up. Here's how the choreography works.

### Components involved

- **Wake-up controller** — a Cloud Function that talks to the GKE API, sets HPA min replicas, watches for readiness, and reports state
- **Wake-up state store** — a single row in a Postgres table tracking the cluster's current state (`asleep | waking | awake | priming | sleeping`) and a timestamp
- **Frontend wake-up gate** — when the site loads, calls `GET /api/wake-status`. If the cluster is asleep, kicks off the wake and shows the warmup splash. If it's awake, proceeds normally.
- **Idle watcher** — a Cloud Scheduler job that runs every 5 minutes, checks recent activity, and triggers sleep if there's been no traffic in 15 minutes.

### Wake-up sequence

```
1. Visitor hits site → frontend calls GET /api/wake-status (Cloud Run, 50ms)
2. Wake controller responds: state=asleep, eta=60s
3. Frontend shows warmup splash with progress
4. Wake controller calls GKE API to set HPA min=1 on all 6 backends + tax-service
5. Autopilot provisions nodes (~30-45s)
6. Pods schedule and reach Ready (~10-20s, varies by runtime)
7. Wake controller flips state to "priming" once all pods Ready
8. 60s priming window: loadgen fires baseline traffic to warm everything
9. Wake controller flips state to "awake"
10. Frontend transitions from splash to live UI
```

Total time visitor waits: ~60-90s. The splash is honest about progress at each phase (see DESIGN.md).

### Sleep sequence

```
1. Idle watcher (every 5min) checks: any visitor activity in the last 15min?
2. If no: state goes "awake" → "sleeping"
3. Wake controller sets HPA min=0 on all backends + tax-service
4. Pods drain (graceful shutdown, ~5s each)
5. Once pods are gone, GKE Autopilot scales the node pool to zero (~2min)
6. State flips to "asleep"
```

Cloud SQL stays running. Prometheus retains its data on a small persistent volume (10Gi) that survives cluster scale-down.

### Edge cases

**Visitor arrives during wake-up.** They see the same splash, same progress. The wake-up controller is idempotent — additional wake requests during waking are no-ops.

**Visitor leaves during wake-up.** Wake completes anyway. The cluster sits awake until the idle watcher catches it 15 minutes later. Worst case: 15-20 minutes of paid uptime for nobody. Acceptable.

**Visitor arrives during sleep transition.** State machine handles this: if "sleeping" state is reached but a wake request comes in before pods fully drain, the controller cancels the sleep and re-wakes. This race is rare but real.

**A backend fails to start.** Wake controller waits 90s for all backends to be Ready. If any fail, it reports the failure to the frontend (which shows "Bun backend failed to start — investigating") and continues with the remaining backends. The methodology audit catches this on the next daily run.

**Daily audit run during sleep.** The daily 4am UTC audit triggers a wake just like a visitor would. Runs the audit, lets the idle watcher put the cluster back to sleep 15 minutes later. Cost: ~$0.50/day.

### Cost ceiling enforcement

The $150/month hard cap is enforced by:

1. **Billing budget alert** at $100 (50%), $135 (90%), and $150 (100%)
2. **Cloud Function** triggered by the 100% alert: forces sleep state, sets HPA min=0 on everything, and disables the wake-up controller until manual reset
3. **Status page** shows "cost cap reached — site offline until [date]" if triggered
4. **Manual reset** required: visit a `/admin/reset-cap` endpoint with a one-time secret, which re-enables the wake controller

This is intentionally aggressive. It's better for the site to go offline for a few days than to surprise-bill the owner. The methodology document explicitly mentions this constraint, since it could affect the comparison's freshness.

---



### Casual order flow

```
Visitor clicks "place order"
    ↓
Frontend POST /api/checkout, headers: X-Runtime: rust, traceparent: 00-...
    ↓
Router checks rate limit, OK; proxies to bo-rust:8080
    ↓
bo-rust handler:
  - Validates input
  - Queries Postgres (SELECT products)
  - Calls tax-service:8080/tax
  - Computes fraud score (50ms CPU)
  - Inserts order + order_items in transaction
  - Returns 201 with order details + traceparent
    ↓
Router returns response to frontend
    ↓
Frontend shows order detail with timing breakdown (from trace)
```

Every step emits Prometheus metrics and OTel spans.

### Stress mode flow

```
Visitor clicks "stress test"
    ↓
Frontend POST /api/stress, body: {runtime: "rust", rps: 100, duration: 30}
    ↓
Router checks if global stress slot is free
  If free: claim slot, return {status: "starting", slot_id: ...}
  If taken: return {status: "queued", queue_depth: 2}
    ↓
On claim: router posts to loadgen Cloud Run service to begin
    ↓
Loadgen runs N concurrent workers firing requests at rate R
  All requests carry X-Runtime: rust
  All requests go through the router
    ↓
Router proxies as usual (rate limit bypass for stress traffic)
    ↓
bo-rust handles requests; metrics flow into Prometheus
    ↓
Frontend polls Prometheus via router every 2s; live chart updates
    ↓
After 30s: loadgen exits, router releases slot, frontend shows summary
```

### Baseline flow

Every minute, Cloud Scheduler triggers a loadgen Cloud Run job with config `{rps: 5, duration: 60, runtimes: ["go","rust","bun","node","python","php"]}`. Loadgen fires 5 RPS at each backend for 60 seconds, then exits. Six backends in parallel = 30 RPS total background load. Cost: ~$3/month.

---

## Network and security

### VPC layout

- **Single VPC**, single subnet (us-west1)
- **GKE cluster**: VPC-native, private nodes, public endpoint disabled (admin via IAP)
- **Cloud SQL**: private IP only, VPC-peered
- **Cloud Run services**: connected to the VPC via Serverless VPC Connector for traffic to the cluster and Cloud SQL
- **Public ingress**: Cloud Load Balancer in front of the frontend and router

### Authentication

- **Frontend → Router**: no auth on the public surface. Requests are rate-limited and the router exposes only safe operations.
- **Router → Backends**: in-cluster, no auth (private network)
- **Router → Loadgen**: shared secret in environment variable, sourced from Secret Manager
- **Backends → Cloud SQL**: per-backend service account with scoped IAM, password sourced from Secret Manager via Workload Identity
- **CI → GCP**: Workload Identity Federation, no static keys

### Secrets

All secrets in Secret Manager:

- `db-password-go`, `db-password-rust`, etc. — per-backend DB user passwords (separate users per schema for isolation)
- `loadgen-shared-secret` — shared between router and loadgen
- `cloudsql-instance-connection` — connection string template

No secret in code, no secret in env files in git, no secret in container images.

---

## Deployment topology

### Container build

Each backend has a multi-stage Dockerfile producing the smallest practical image:

| Runtime | Base image | Final image size |
|---|---|---|
| Go | distroless/static | ~15MB |
| Rust | distroless/cc | ~25MB |
| Bun | bun-distroless equivalent | ~70MB |
| Node | distroless/nodejs20 | ~85MB |
| Python | distroless/python3.12 | ~120MB (slim) |
| PHP | php:8.3-fpm-alpine + RoadRunner | ~95MB |

Image size is NOT a benchmark metric, but is reported in the case study.

### CI pipeline

GitHub Actions workflow on push:

1. **Detect changes**: which backends changed?
2. **Build changed backends in parallel** (matrix strategy)
3. **Run contract tests** against each changed backend in a transient Docker network
4. **Run methodology audit**: verify each backend's deployment manifest matches the canonical spec
5. **Push images** to Artifact Registry, tagged with commit SHA
6. **Deploy via Helm** to GKE: rolling update, wait for readiness, smoke test
7. **Run replay benchmark** against the new revision; if any runtime drifts >20% from rolling baseline, fail the deploy
8. **Update Cloud Run services** (frontend, router, loadgen)

A push that changes only one backend rebuilds and redeploys only that backend. A push that changes the contract or methodology rebuilds everything.

### Helm chart structure

```
infra/k8s/charts/
├── bakeoff/                   ← umbrella chart
│   ├── Chart.yaml
│   ├── values.yaml            ← canonical resource specs (the locked variables)
│   └── templates/
│       ├── backend.yaml       ← templated Deployment + Service
│       ├── tax-service.yaml
│       ├── prometheus.yaml
│       └── grafana.yaml
└── values/
    ├── go.yaml                ← per-runtime overrides (image, port, anything ALLOWED to vary)
    ├── rust.yaml
    ├── bun.yaml
    ├── node.yaml
    ├── python.yaml
    └── php.yaml
```

The methodology audit (CI step 4) validates that no override file changes a locked-down value. If `python.yaml` tries to bump CPU to 4000m, the audit fails.

---

## Observability details

### Metrics

Every backend exports the same metric names. The cardinality is bounded:

- `runtime` label: 6 values
- `status` label: ~5 values (200, 400, 422, 500, 503)
- `method` label: 1 value (POST)
- `path` label: ~3 values (/checkout, /health, /metrics)

Total active series per backend: ~50. Total cluster-wide: ~300. Prometheus handles this easily.

Histograms:

```
http_request_duration_seconds (label: runtime, status, path)
  buckets: 1ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s
db_query_duration_seconds (label: runtime, operation)
  buckets: 0.5ms, 1ms, 2ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms
```

### Traces

Span structure for a `/checkout` request:

```
http.request (root span, runtime=rust)
├── parse_input
├── inventory.query (DB span)
├── tax.call (HTTP client span → tax-service)
│   └── http.request (server span on tax-service)
│       └── compute (delay span)
├── fraud.score (CPU span)
└── order.persist (DB span, has child INSERT spans)
```

Sampling: tail-based at the OTel Collector. Always sample errors and any request >500ms. Sample 10% of fast requests. Total ingest to Cloud Trace: ~10K spans/day.

### Logs

JSON to stdout, identical fields:

```json
{"ts":"...","level":"info","msg":"checkout.complete","runtime":"rust","request_id":"...","duration_ms":47,"order_id":"..."}
```

Log level: INFO in production. DEBUG only when explicitly enabled per pod via a config map flip (used during development).

---

## Cost model

Approximate monthly cost at the design's traffic levels (cluster awake roughly 8 hours/day in aggregate, occasional stress runs, hundreds of casual orders, daily audit run).

| Resource | Monthly | Notes |
|---|---|---|
| GKE Autopilot (6 backends + tax + observability) | ~$35 | Scales to zero ~16h/day; control plane runs always |
| Cloud SQL Postgres 18 (db-custom-1-3840) | ~$35 | Always-on |
| Cloud Run (frontend + router + loadgen + wake controller) | ~$5 | Scales to zero |
| Cloud Trace + Logging + Monitoring | ~$10 | Mostly free tier |
| Cloud Load Balancer + DNS | ~$20 | Required for custom domain |
| Artifact Registry | ~$2 | |
| Egress + misc | ~$3 | |
| **Total** | **~$110/month** | Hard-capped at $150/month |

Compared to the always-on design (~$230/month), the wake-up architecture saves ~$120/month — roughly half. The savings come almost entirely from GKE node hours.

**Cost mitigations already in the design:**
- Cluster scales to zero after 15min idle
- Cloud SQL is sized for the workload (1 vCPU is plenty at 5-200 RPS)
- Daily audit is brief (~10 minutes of cluster runtime)
- Stress mode is daily-quota-capped to prevent runaway spend
- Hard $150/month cap auto-pauses everything if breached

**Cost mitigations rejected:**
- **Spot VMs for backends.** Preemption distorts latency. Not worth the savings.
- **In-cluster Postgres.** Saves ~$35/month but creates methodology violations and adds 10-15s to wake-up time.
- **Smaller Cloud SQL (db-f1-micro).** Too small; CPU contention skews results. Tested in v0 prototyping if curious, but not for the live site.
- **Cluster pause overnight only.** The wake-up cluster handles this more flexibly.

The case study should be honest about cost. "I run six pods on demand, with a 60-second wake-up splash, and it costs ~$110/month with a hard $150 cap" is an interesting line to write — it shows the project's commitment to its own methodology *and* to keeping the owner solvent.

---

## Failure modes and recovery

### A backend pod crashes

- Liveness probe fails after 3 consecutive misses (15s)
- GKE restarts the pod
- During the restart window, requests with that runtime return 503 from the router
- Live chart shows "elevated error rate" badge
- Once readiness passes, the "warming up" overlay shows for 30s
- After 30s of clean data, normal display resumes

### Cloud SQL becomes unresponsive

- All six backends start failing equally
- Live chart shows error rate > 50% across all runtimes
- Site shows a global "database degraded" banner
- Page-level alert fires (uptime check on `/api/health`)

### A specific runtime is slow

- The dashboard shows it. That's the point of the project.
- No alert; this isn't an error condition.

### Stress mode misbehaves

- Loadgen has a hard timeout (35s); if it doesn't release the slot in 35s, the router force-releases at 60s
- Cost cap: stress mode globally limited to 200 stress runs per day (visible counter on the site)

### Cluster fails to wake

- Wake-up controller times out after 90s
- Frontend shows "wake-up failed — please try again in a moment" with a manual retry button
- Alert fires to email
- Common causes: GCP quota exhaustion, image pull issues after a deploy, node availability in the region
- The frontend never auto-retries; visitors decide

### Cost runaway

- Budget alerts at $100 (info), $135 (warning), $150 (action)
- $150 alert triggers the auto-pause Cloud Function: forces sleep, disables wake controller, status page goes to "offline — cost cap reached"
- Manual reset required (visit `/admin/reset-cap` with a one-time secret)
- The hard cap means the project can never surprise-bill more than ~$150 in a month, even under abuse

---

## Local development

A `docker-compose.yml` brings up:

- Postgres 18
- All six backends
- The tax service
- The router
- The frontend (in dev mode)

Loadgen and Prometheus run on the host (loadgen via `go run`, Prometheus via the official binary pointed at the compose network).

The methodology audit runs as a pre-commit hook to catch fairness regressions before they reach CI.

A single `make dev` brings everything up. A single `make bench` runs the contract tests + a 30-second baseline benchmark and prints the results.
