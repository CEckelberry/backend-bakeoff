# Backend Bake-off

> Six backend implementations of the same e-commerce checkout endpoint, deployed side-by-side on Kubernetes. Hot-swap the runtime mid-session and watch p95 latency, throughput, and resource usage shift in real time.

The point isn't to declare a winner. The point is to let people change variables — runtime, payload size, RPS, cart complexity — and see what happens, on a real workload, with all six implementations running on identical hardware against the same database.

## What this is

A living benchmark you can poke at. Pick a runtime tab; orders flow to that pod. Pick another; they flow to a different pod. Pick "compare" and the same request fans out to two pods so you can see the delta on identical input.

A single, opinionated workload — `POST /checkout` — implemented six times:

| Runtime | Framework | Language sweet spot |
|---|---|---|
| Go | `fiber` | High-throughput HTTP, minimal GC overhead |
| Rust | `axum` + `tokio` | Lowest tail latency, highest throughput |
| Rails | `rails 8` + `puma` | The full-stack framework baseline |
| Node | `fastify` | The realistic baseline most teams ship |
| Python | `fastapi` + `uvicorn` | Async Python, what most data orgs use |
| PHP | plain PHP 8.3 | The unfair fight that surprises people |

All six speak an identical OpenAPI contract. The contract is the source of truth — server stubs are generated from it, request/response types match exactly, and a contract conformance test runs in CI to prove every backend handles every edge case the same way.

## What this isn't

- Not a microbenchmark. We're testing realistic web work, not synthetic loops.
- Not a "Rust beats everything" project. Rust will win some metrics. Rails will surprise you in others. PHP will surprise you too. The interesting part is *where each language wins and why*.
- Not a static benchmark. Numbers from October don't mean anything in March. The site shows live numbers from a system you can interact with right now.
- Not a TechEmpower clone. TechEmpower is a static results table with synthetic workloads. This is an interactive demo with a realistic workload that you can drive.

## Repository layout

```
bakeoff/
├── README.md
├── METHODOLOGY.md           ← fairness rules, what we measure and how (the credibility doc)
├── Makefile                 ← local dev shortcuts (up, down, bench, seed)
├── docker-compose.yml       ← full local stack including all 6 backends + results-api
├── api/
│   └── openapi.yaml         ← single source of truth for the HTTP contract
├── apps/
│   ├── backends/
│   │   ├── go/              ← Go / Fiber
│   │   ├── rust/            ← Rust / Axum + Tokio
│   │   ├── rails/           ← Rails 8 / Puma
│   │   ├── node/            ← Node / Fastify
│   │   ├── python/          ← Python / FastAPI + Uvicorn (4 workers)
│   │   └── php/             ← Plain PHP 8.3 built-in server
│   ├── results-api/         ← Standalone Go service: stores & serves benchmark runs
│   └── tax-service/         ← Shared tax calculation service (intentional bottleneck)
├── packages/
│   └── seed-data/           ← DB migrations, product catalog, baseline benchmark results
├── infra/
│   └── observability/       ← Prometheus + Grafana config
└── scripts/                 ← Benchmark runner, baseline results, audit tooling
```

## Stack at a glance

- **Backends**: Go/Fiber, Rust/Axum, Rails 8/Puma, Node/Fastify, Python/FastAPI, PHP 8.3 — all exposing the same OpenAPI contract
- **Results API**: Standalone Go service (separate from the backends) — stores baseline and user-submitted benchmark runs in Postgres, exposes `GET /results` and `POST /results`
- **Tax service**: Shared HTTP service intentionally shared by all backends — the common bottleneck under high concurrency
- **Database**: Postgres, one instance, six isolated schemas (`bakeoff_go`, `bakeoff_rust`, etc.) plus `public.benchmark_runs` for results storage
- **Observability**: Prometheus + Grafana; per-backend CPU and memory scraped via `/metrics` endpoints
- **Local dev**: `docker-compose up` brings up all 6 backends, tax service, results-api, Postgres, Prometheus, and Grafana
- **CI/CD**: GitHub Actions

## Three modes of interaction

**Casual.** Place orders. Watch the metrics shift. No scenario, no constraint, just play.

**Comparison.** Pick two runtimes. The page splits. Same request fires at both. Latency and result shown side-by-side. Useful for "is Rust really 2x Go on this workload?" — and the answer changes with payload size in a way that's worth seeing.

**Stress.** A slider from 1 to 200 RPS sustained for 30s. Loadgen fires concurrent requests; the live charts show p50, p95, p99, and error rate as load ramps. Each visitor session is rate-limited to one stress run per minute to protect the budget.

## Why this is a good portfolio project

It demonstrates:

- **Six runtimes, one contract** — Go, Rust, Rails, Node, Python, and PHP all implement the same OpenAPI spec. Writing six idiomatic implementations proves you know where each language's seams are
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
