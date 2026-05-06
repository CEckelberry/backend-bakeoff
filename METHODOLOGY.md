# Methodology

This document defines what "fair" means in this project. It is the most important document in the repository — every other decision (which framework, which deploy config, which metrics) flows from these rules.

The rules are **opinionated**. Reasonable engineers will disagree with some of them. That's fine; the case study should call out where we made a judgment call and why.

---

## Core principle

> When a visitor flips the runtime tab, the only thing that should change is the language and framework serving the request. Everything else — hardware, database, network path, payload, observability instrumentation — must be identical.

If we accidentally compare "Rust on a 4-vCPU node" against "Python on a 1-vCPU node", we're not benchmarking languages. We're benchmarking node sizes. Same goes for connection pool size, cold-start state, replica count, network egress region, JIT warmup, and a dozen other variables.

The METHODOLOGY rules below exist to lock those variables down.

---

## The wake-up cluster

The cluster scales to zero nodes after 15 minutes of inactivity. When a visitor lands on the site, the cluster wakes up, the six backends start, a 60-second priming window runs, and only then does measurement begin.

This sounds like a methodology violation — "but you said cold starts distort the comparison!" — and it would be, if we were measuring during the warmup. We're not. The wake-up window is explicitly excluded from measurement, and the UI tells visitors when it's happening.

**The honesty rules around wake-up:**

1. **The site shows a "warming up" splash** when the cluster is asleep or starting. No live chart, no order placement, no stress mode. Just a status display showing what's happening.
2. **The first 60 seconds after every backend reaches Ready state are excluded from metrics.** Not greyed out — actually filtered at the Prometheus query layer. The histogram doesn't accept samples until the priming window passes.
3. **The Casual order panel runs three priming requests against the selected backend** before the visitor's first real order. These three are also excluded from metrics.
4. **The "last verified" timestamp on the methodology badge** reflects the most recent post-warmup verification, not the most recent CI run.

The reason this works: cold-start behavior is a real characteristic of each runtime, but it's a *separate measurement* from steady-state request handling. The case study has its own section on cold starts, where each runtime is given the same warmup procedure and measured fairly. Mixing the two would be the methodology failure; keeping them separate preserves the comparison.

**What sleeping actually means:**
- GKE Autopilot scales the node pool to zero
- All 6 backend pods are evicted, along with the tax service
- Prometheus retains its data on a small persistent volume
- Cloud SQL stays running (it's not in the cluster — see the Database section)
- Cloud Run services (frontend, router, loadgen) stay scaled-to-zero, ready to wake instantly

**What waking up looks like:**
1. A visitor hits the frontend (Cloud Run, instant)
2. The frontend calls a wake-up endpoint on the router
3. The router triggers a Cloud Function that scales the GKE node pool to 1 node
4. Once a node is Ready, all 6 backend pods + tax service are scheduled
5. Each backend takes 5-15s to reach Ready (varies by runtime)
6. The 60s priming window starts as soon as all backends are Ready
7. The site flips from "warming up" to live

Total wake-up time: ~60-90s. The UI shows progress through each phase, which is its own piece of UX (see DESIGN.md).

**Why this preserves credibility:** the measurement window is identical to the always-on design once the system is awake. We just accept the cost of advertising "the cluster sleeps when nobody's here" honestly, rather than pretending we run a 24/7 production benchmark. For a portfolio project, this trade is correct.

---

## What we measure

Five metrics, captured per request, aggregated per runtime, displayed live:

| Metric | Definition | Notes |
|---|---|---|
| **Latency p50** | Median end-to-end response time | The "happy path" experience |
| **Latency p95** | 95th percentile response time | The tail; what users feel under load |
| **Latency p99** | 99th percentile response time | Where bad days hide |
| **Throughput (RPS)** | Successful requests per second | Sustained over the measurement window |
| **Error rate** | (5xx + timeouts) / total requests | Anything not 2xx counts |

Two additional metrics shown in the dashboards but not in the live UI:

- **CPU per request** — captured via Prometheus, useful for cost-per-request analysis
- **Memory in flight** — RSS during sustained load

### What we deliberately do NOT measure

- **Cold start latency.** This is its own interesting metric, but mixing it into the live latency chart misleads people. Cold-start gets its own dedicated section in the case study, with all six runtimes given the exact same warmup procedure (3 priming requests, 60s settling, then measure).
- **Lines of code.** Different languages have different verbosity norms. LoC comparisons across PHP and Rust are meaningless.
- **"Developer experience."** Subjective, untestable, the wrong fight to pick.
- **Memory usage at idle.** Some runtimes (Python with FastAPI) hold more idle RSS but use less under load. Memory under load is what matters; idle memory is a distraction.

### How we report percentiles

Percentiles are **calculated, not averaged**. A common bug is computing p95 across multiple pods by averaging each pod's p95 — that gives a number, but it's not the p95. We use Prometheus `histogram_quantile()` over the union of all pod histograms, which gives a true distribution-wide percentile.

Histograms use Prometheus' default exponential buckets from 1ms to 10s, plus extra buckets at 5ms, 10ms, 25ms, 50ms, 100ms (the resolution we care about for this workload).

---

## What we hold constant

These are the variables we lock down identically across all six runtimes.

### Hardware

- **Node type**: GKE Autopilot, but pinned to the same machine class via `cloud.google.com/compute-class: Performance` and `cloud.google.com/machine-family: c3` selectors. Each backend pod gets its own node — no co-tenancy.
- **CPU request and limit**: 2000m / 2000m (1:1, no bursting). Bursting hides differences in steady-state efficiency.
- **Memory request and limit**: 1024Mi / 1024Mi.
- **Replicas**: exactly 1 per backend. No HPA. We're benchmarking the runtime, not Kubernetes' autoscaling.
- **Storage**: `emptyDir` (memory-backed) for any local scratch space. No persistent volumes.

### Database

- **Single Cloud SQL Postgres 18 instance** shared by all six backends.
- **Each backend gets its own schema** (e.g., `bakeoff_go`, `bakeoff_rust`) — same DDL, separate tables. This isolates writes so a slow runtime can't pollute a fast runtime's data, while keeping everyone on the same physical hardware.
- **Connection pool size**: 20 per backend. Held constant. Configured at the application layer (not at PgBouncer) so each runtime's driver is what's being tested.
- **Network**: same VPC, same region (us-west1), private IP only. RTT to Cloud SQL is ~1ms in steady state.
- **Cloud SQL stays running when the cluster sleeps.** The DB instance is `db-custom-1-3840` (1 vCPU, 3.75GB), ~$35/month, and it doesn't auto-pause. This is the cost of having a database that's instantly ready when the cluster wakes — keeping it warm is much cheaper than the engineering effort to safely cold-start a database.

### Network path

- All backends sit behind a single Kubernetes Service of type `ClusterIP` (one Service per backend, but each is in the same cluster, same namespace).
- The router proxies via headless service DNS (`bo-{runtime}.bakeoff.svc.cluster.local`).
- TLS terminates at the router; backends speak plaintext HTTP/1.1 inside the cluster.
- No service mesh. No sidecar proxies. The point is to measure the runtime, not Istio.

### Workload

- **Single endpoint**: `POST /checkout`
- **Request payload**: 3 to 8 line items, generated from a fixture pool of ~200 products
- **Response payload**: same shape across runtimes (validated by contract tests)
- **No caching** at the application layer. Postgres' query plan cache is fair game (it's part of the runtime's behavior under repeated queries) but no Redis, no in-memory product cache.

### Instrumentation

- All six backends emit identical Prometheus metrics:
  - `http_requests_total{runtime, status, method, path}`
  - `http_request_duration_seconds{runtime, status, method, path}` (histogram)
  - `http_requests_in_flight{runtime}`
  - `db_query_duration_seconds{runtime, operation}` (histogram)
- All six emit OpenTelemetry traces to the same Cloud Trace endpoint, with the same span names (`http.request`, `db.query`, `fraud.score`, `tax.calc`).
- All six log in JSON to stdout with the same field names (`ts`, `level`, `msg`, `request_id`, `runtime`).
- Instrumentation overhead is itself a confounding variable. We use the same instrumentation library (the OTEL SDK) in every language to keep overhead comparable.

### Container build and deploy

- All containers built with the **same Dockerfile pattern**: multi-stage build, distroless or minimal runtime image, identical entrypoint shape (the binary or interpreter is the PID 1).
- All containers built in CI with the same builder (BuildKit on GitHub Actions runners), same base image versions pinned by SHA.
- All containers deployed via Helm with the same values for resources, replicas, probes, lifecycle.
- All containers warmed up the same way before measurement: 3 priming requests, 60s settling, then start collecting metrics.

---

## What we deliberately let vary

These are the things that *are* allowed to differ — they're the runtime's character.

- **HTTP server implementation.** Each language uses its idiomatic, production-grade HTTP server. Go uses `chi`, Rust uses `axum`/`tokio`, Bun uses `hono`, Node uses `express`, Python uses `fastapi` (with Uvicorn workers), PHP uses Laravel Octane (with RoadRunner). Picking obscure servers to win the benchmark is forbidden; picking the most-used production server is required.
- **Database driver.** Each runtime uses the most-used driver for its language. Go uses `pgx`. Rust uses `sqlx`. Node uses `pg`. Python uses `asyncpg`. PHP uses native PDO+pgsql. Bun uses `bun:sql` if stable enough, otherwise `pg`.
- **Concurrency model.** Each runtime uses its native model. Go: goroutines. Rust: `tokio` async. Node/Bun: event loop. Python: asyncio. PHP: Octane workers. We don't force a thread-per-request model on Go just to match PHP's worker model.
- **Process model.** Each runtime gets the worker count it would naturally run with in production:
  - Go, Rust, Bun: single process (the runtime handles concurrency internally)
  - Node: single process (clustering is a deployment concern, not a runtime concern, for this benchmark)
  - Python: 4 Uvicorn workers (matching production patterns; single-worker FastAPI is a strawman)
  - PHP: 4 Octane workers (matching production patterns)

The Python and PHP worker counts ARE a fairness compromise — pure single-process would make them look much worse, but multi-worker is how teams actually run them. The case study calls this out explicitly.

---

## Workload definition

`POST /checkout` — the canonical request shape:

```json
{
  "cart": [
    { "product_id": "uuid", "quantity": 1 },
    { "product_id": "uuid", "quantity": 3 }
  ],
  "shipping_address": {
    "country": "US",
    "postal_code": "94102"
  },
  "customer_id": "uuid"
}
```

Server-side processing:

1. **Validate input** — parse, type-check, basic sanity (quantity > 0, ≤ 8 line items)
2. **Inventory check** — `SELECT id, sku, name, price_cents, stock FROM products WHERE id = ANY($1)` with all line-item product IDs in a single query
3. **Tax calculation** — call out to a fake "tax service" running in the same cluster that adds a constant 5–15ms simulated latency (chosen randomly per request from a uniform distribution to avoid synchronized callers)
4. **Fraud scoring** — a fixed CPU-bound function: compute SHA-256 over a 32KB synthetic payload 10 times, then compute a "score" from the result. Designed to take ~50ms on the standard node. This is the workload's CPU floor — every request, every runtime, has this floor to climb.
5. **Persist order** — `INSERT INTO orders` + `INSERT INTO order_items` (1 + N inserts, in a transaction)
6. **Return response** — order ID, total, line items, computed tax

The full request from network ingress to response should take 60–100ms in the steady state on the fastest runtime. The slowest runtimes will be in the 200–400ms range under load. Anything outside that range is a sign something's wrong with the implementation, not the runtime.

### Tax service

A small Go service (`apps/tax-service/`) that responds to `POST /tax` with a computed amount, after sleeping a random 5–15ms. Lives in the same cluster, same node pool, same availability. Every backend calls it the same way. Its job is to make the workload realistic — pure compute-and-DB benchmarks don't reflect production work.

### Fraud function (the CPU floor)

```pseudo
function fraud_score(payload):
    h = payload
    for i in 1..10:
        h = sha256(h)
    return h[0..8] modulo 100
```

The function takes ~50ms on a c3 vCPU. This is identical work for every runtime, but the runtime's overhead in *getting to* this CPU work and *handling* its result is what we're measuring. Languages with low-overhead system calls (Go, Rust) will be very close to 50ms. Languages with heavy interpreter overhead (PHP) will add measurable wall-clock time on top.

---

## How sessions and traffic work

Visitors browsing the site can place orders manually (Casual mode) or run a stress test (Stress mode). To prevent abuse and keep the comparison meaningful:

- **Per-IP rate limit** for casual orders: 60/minute (set at the router, returns 429 above)
- **Per-session stress mode**: 1 run per 60 seconds, max 30 seconds duration, max 200 RPS
- **Global stress mode budget**: only 1 stress run can be in flight at a time across all visitors. The slot is gated at the loadgen service. Visitors trying to stress while another is running see "queue depth: 2" and a wait estimate.
- **Background load while awake**: while the cluster is awake (a visitor is on the site or the cluster is in its 15-minute idle countdown), the loadgen service runs a continuous 5 RPS baseline against all six backends. This keeps connections warm, JITs hot, and the metrics chart populated. Once the cluster scales to zero, baseline stops and resumes on next wake.
- **Drift detection**: a daily Cloud Scheduler job at 4am UTC briefly wakes the cluster, runs the methodology audit (a fixed sequence of 1,000 requests per backend), records the results to Postgres, and lets the cluster sleep again. Cost: ~$0.50/day. This catches silent drift even when the site has had no visitor traffic.

---

## Reporting and the live UI contract

The live latency chart on the site shows **the last 60 seconds of p50/p95/p99**, refreshed every 2 seconds. Sources: Prometheus.

The chart is honest:

- It shows a "warming up" overlay if a backend has fewer than 30s of post-startup data
- It shows an "elevated error rate" badge if a backend's error rate is > 1% over the window
- It shows a "stale data" warning if Prometheus' last successful scrape is older than 30s
- It does NOT smooth the lines. Real latency has spikes; smoothing would lie about them.

The "place an order" button on the site fires a real `POST /checkout` against whichever runtime is selected. The result panel shows the actual server-side trace (via the W3C `traceparent` returned in headers) and breaks down where the time went: validation, DB, tax, fraud, DB write. This is where the difference between runtimes becomes legible — Rust spends 2ms on validation; PHP spends 8ms.

---

## How we handle the inevitable disagreements

A senior engineer reading the case study will object to at least three of these decisions. The case study should preempt the most likely objections in the "Decisions" section:

**"You should use HTTP/2."**
We use HTTP/1.1 inside the cluster because HTTP/2's multiplexing benefits don't apply to a single-stream proxy hop, and HTTP/1.1 is the closer parallel to what most real-world setups look like at this layer. HTTP/2 between client and router is enabled (it's the public path).

**"Your worker counts are arbitrary."**
They are. We picked 4 for Python and PHP because that's a common production setting. We could pick 2, or 8, or auto-scale by CPU, and get different numbers. The case study explicitly says "with these worker counts."

**"Single-region, single-AZ benchmarks are dishonest."**
For this project, yes — multi-AZ would add 1–2ms RTT between client and DB, but it would add it equally to every runtime, so the relative differences would be unchanged. We optimize for showing relative differences clearly, not absolute production realism.

**"You're benchmarking the framework, not the language."**
We're benchmarking what people actually deploy. Pure-language benchmarks (writing your own HTTP loop in each language) are a different project, and a much less useful one. Most teams choose a framework. The framework is what they ship.

**"The fraud function isn't representative."**
It's deliberately CPU-bound and identical across runtimes. It models the kind of fixed CPU work many real endpoints have (cryptographic operations, image hashing, data validation). We could swap it for a different workload (database-heavy, network-heavy) and the rankings would shift. That's a feature; the comparison toggle lets people see what shifts when.

The case study should NOT pretend these decisions are objectively correct. They're the choices we made, and the writing should own them.

---

## Verification: how we prove fairness

The methodology document is just text. The fairness has to be verifiable. Three concrete checks live in CI:

### 1. Contract conformance test

A test suite runs against each backend after deploy. It fires a curated set of requests (valid orders, malformed JSON, missing fields, invalid product IDs, oversized carts) and asserts identical response codes and shapes from every backend. If Rust returns `400` and Node returns `422` for the same malformed input, the test fails the deploy.

### 2. Resource enforcement check

A Kubernetes admission policy (Kyverno or OPA Gatekeeper) rejects backend deployments whose CPU/memory don't match the canonical spec. If someone accidentally bumps Rust to 4 vCPU "to see what happens," the cluster refuses to deploy it.

### 3. Workload audit script

A daily Cloud Scheduler job at 4am UTC wakes the cluster, replays a fixed sequence of 1,000 requests against each backend (same payloads, same order, same timing), records p50/p95/p99 to Postgres, and lets the cluster sleep again. If any runtime drifts by more than 20% from its rolling 7-day average, it sends an alert. This catches silent degradation (a dependency upgrade, a node noisy neighbor) and is also the dataset that powers the case study's "trends over time" chart.

A daily wake-and-audit run costs roughly $0.50, well within the budget.

These three checks together let the site claim — and the case study show — that the comparison is genuinely fair, not just claimed-to-be-fair.

---

## Things this methodology cannot answer

In the spirit of being honest about the project's limits, the case study should explicitly list what this benchmark does NOT tell you:

- Which language is "best." That depends on your team, your hiring market, your ops culture.
- Which framework is fastest in absolute terms. The fastest framework in each language was picked partly for fairness, partly for production realism — they're not always the same thing.
- How these runtimes scale to 100K RPS. The benchmark caps at 200 RPS for cost reasons. Scaling characteristics beyond that are an extrapolation.
- Memory pressure characteristics over hours. We measure 30-second windows. Memory leaks would only surface in a longer run.
- How developer productivity compares. That's a different project entirely, and usually a survey, not a benchmark.

This list goes in the case study. It builds trust by surfacing the limits before someone else does.
