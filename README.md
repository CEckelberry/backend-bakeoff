# Backend Bake-off

> Six backend implementations of the same e-commerce checkout endpoint, deployed side-by-side on Kubernetes. Hot-swap the runtime mid-session and watch p95 latency, throughput, and resource usage shift in real time.

The point isn't to declare a winner. The point is to let people change variables — runtime, payload size, RPS, cart complexity — and see what happens, on a real workload, with all six implementations running on identical hardware against the same database.

## What this is

A living benchmark you can poke at. Pick a runtime tab; orders flow to that pod. Pick another; they flow to a different pod. Pick "compare" and the same request fans out to two pods so you can see the delta on identical input.

A single, opinionated workload — `POST /checkout` — implemented six times:

| Runtime | Framework | Language sweet spot |
|---|---|---|
| Go | `chi` + stdlib | Cloud-native middleware, simple deploys |
| Rust | `axum` + `tokio` | Lowest tail latency, highest throughput |
| Bun | `hono` | New entrant, JS without Node's overhead |
| Node | `express` | The realistic baseline most teams ship |
| Python | `fastapi` | Async Python, what most data orgs use |
| PHP | `laravel-octane` | The unfair fight that surprises people |

All six speak an identical OpenAPI contract. The contract is the source of truth — server stubs are generated from it, request/response types match exactly, and a contract conformance test runs in CI to prove every backend handles every edge case the same way.

## What this isn't

- Not a microbenchmark. We're testing realistic web work, not synthetic loops.
- Not a "Rust beats everything" project. Rust will win some metrics. Bun will win others. PHP will surprise you. The interesting part is *where each language wins and why*.
- Not a static benchmark. Numbers from October don't mean anything in March. The site shows live numbers from a system you can interact with right now.
- Not a TechEmpower clone. TechEmpower is a static results table with synthetic workloads. This is an interactive demo with a realistic workload that you can drive.

## Repository layout

```
bakeoff/
├── README.md
├── ARCHITECTURE.md          ← system design, cluster, deployment topology
├── METHODOLOGY.md           ← fairness rules, what we measure and how (the credibility doc)
├── DESIGN.md                ← UX, visuals, motion, copy
├── TASKS.md                 ← phased build plan
├── RUNTIMES.md              ← per-backend implementation specs
├── api/
│   └── openapi.yaml         ← single source of truth for the contract
├── apps/
│   ├── web/                 ← SvelteKit frontend
│   ├── router/              ← Go service that routes traffic by header
│   ├── loadgen/             ← Go service that generates load for stress mode
│   └── backends/
│       ├── go/              ← Go implementation of /checkout
│       ├── rust/            ← Rust implementation
│       ├── bun/             ← Bun implementation
│       ├── node/            ← Node implementation
│       ├── python/          ← Python implementation
│       └── php/             ← PHP implementation
├── packages/
│   ├── contracts/           ← generated client/server types per language
│   └── seed-data/           ← canonical product catalog, fixture orders
├── infra/
│   ├── terraform/           ← GKE cluster, Cloud SQL, networking, DNS
│   ├── k8s/                 ← Kubernetes manifests (Helm or Kustomize)
│   └── observability/       ← Prometheus, Grafana, OpenTelemetry config
└── .github/workflows/
```

## Stack at a glance

- **Frontend**: SvelteKit, TypeScript, Tailwind v4, Chart.js for live metrics
- **Router**: Go service, `chi` + `httputil.ReverseProxy`, runs on Cloud Run
- **Backends**: as listed above, all on GKE
- **Database**: Cloud SQL Postgres 18, single `db-custom-1-3840` instance, shared by all six backends with their own isolated schemas
- **Observability**: Prometheus (in-cluster), Grafana (in-cluster, embedded into the site for dashboards), OpenTelemetry traces to Cloud Trace
- **Hosting**: GKE Autopilot for backends + Prometheus (scales to zero after 15min idle), Cloud Run for frontend + router + loadgen
- **Cost target**: ~$105/month at typical traffic, hard-capped at $150/month via billing automation
- **CI/CD**: GitHub Actions, Workload Identity Federation, builds all 6 backend containers in parallel

## Three modes of interaction

**Casual.** Place orders. Watch the metrics shift. No scenario, no constraint, just play.

**Comparison.** Pick two runtimes. The page splits. Same request fires at both. Latency and result shown side-by-side. Useful for "is Rust really 2x Go on this workload?" — and the answer changes with payload size in a way that's worth seeing.

**Stress.** A slider from 1 to 200 RPS sustained for 30s. Loadgen fires concurrent requests; the live charts show p50, p95, p99, and error rate as load ramps. Each visitor session is rate-limited to one stress run per minute to protect the budget.

## Why this is a good portfolio project

It demonstrates:

- **Six languages of comfort** — you don't need to be expert in all six, but writing six idiomatic implementations of the same contract proves you know where each language's seams are
- **Kubernetes architecture beyond hello-world** — header-based routing, headless services, HPA tuning, fairness across pods, autoscaling pinned off so the test is meaningful
- **Observability done right** — Prometheus metrics, OpenTelemetry traces, p50/p95/p99 reported correctly (not averaged), service-level dashboards
- **Methodology rigor** — the project's credibility hinges on the fairness story. The METHODOLOGY doc is half the case study.
- **Product instinct** — interactive demos beat static blog posts. People will share screenshots; some will run the stress mode for fun.

## Read order

If you're starting from zero:

1. `METHODOLOGY.md` first — every other decision flows from this. If the methodology isn't credible, the rest is theater.
2. `ARCHITECTURE.md` second — how the system is wired
3. `RUNTIMES.md` third — the per-backend specs
4. `DESIGN.md` fourth — the UI
5. `TASKS.md` last — the build plan that turns all of this into shipped code

If you're handing tasks to Claude Code, pin `METHODOLOGY.md` and `ARCHITECTURE.md` in the context for every task that touches a backend. The fairness rules apply to all six implementations.
