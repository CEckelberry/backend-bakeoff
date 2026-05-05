# Backend Bake-off

> Same e-commerce checkout endpoint, six backend implementations. Hot-swap them mid-session and watch p95 latency lie to your face.

**Status:** ⚪ Concept · not started yet · case study at [cole-eckelberry.com/work/bakeoff](https://cole-eckelberry.com/work/bakeoff)

## The pitch

Every backend benchmark you've read was written by someone with a horse in the race. The problem isn't that the numbers are wrong; it's that you can't see them move under workloads you care about. This site is one frontend (a small e-commerce checkout flow) backed by six independent implementations of the same `POST /checkout` endpoint. You pick which runtime serves your requests via a tab. The page reloads, the runtime changes, and you watch p95, RPS, and cold-start metrics shift in real time.

The point isn't to declare a winner. The point is to let people change variables and see what happens.

## The six runtimes

| Runtime | Framework | Notes |
|---|---|---|
| Go | `chi` + stdlib | The control implementation |
| Rust | `axum` + `tokio` | Speed-of-light for this workload |
| Bun | `hono` | The new entrant |
| Node | `express` | The baseline most teams actually run |
| Python | `fastapi` | Async Python, what most data orgs ship |
| PHP | `laravel` | The unfair fight that surprises people |

Deliberately not on the list: JVM (cold-start distortion needs too many footnotes), Deno (too similar to Bun for the sample size).

## The endpoint

`POST /checkout` accepts a cart of 3–8 items, validates inventory, computes tax via a fake remote service with simulated latency, runs a fraud score (50 ms of pure CPU), persists the order to Postgres, returns 200 with the order id.

Codegen produces server stubs and client types in every language so the implementations can't drift from the schema.

## Architecture

```
Browser → Router (Go) → bo-{runtime} pod → Postgres
                                  ↓
                            Prometheus scrape
```

The frontend calls a single `POST /api/checkout` on a router service. The router (a small Go service) reads `X-Runtime: rust|go|bun|node|python|php` and forwards to the matching backend pod via Kubernetes' headless service DNS. Switching runtime is a header change in the frontend — no redeploy, no env-var toggle.

All six pods run continuously, all backed by the same Cloud SQL Postgres. Prometheus scrapes them on the same interval. The frontend pulls live metrics from `/api/metrics` (proxied through the router from Prometheus' HTTP API) and renders bar charts that update every two seconds.

## Modes

- **Casual** — place orders, watch the metrics shift.
- **Comparison** — pick two runtimes; the page splits and runs the same request to both, side-by-side.
- **Stress** — slider from 1 to 200 RPS. The page generates load (rate-limited per visitor IP) and shows how each runtime degrades. P95, p99, error rate.

## Tech stack (planned)

- **Frontend:** SvelteKit, TypeScript, Tailwind v4, `chart.js`
- **Router:** Go (`chi` + `httputil.ReverseProxy`)
- **Backends:** as listed above
- **Infra:** GKE Autopilot cluster, a Helm chart per backend, single Cloud SQL Postgres
- **Metrics:** Prometheus + Grafana in-cluster
- **Load generation:** Go service, rate-limited per session

## Why GKE and not Cloud Run

Cloud Run scales to zero, which would distort cold-start data. The cold-start latency for some runtimes (Bun, Python) is itself an interesting metric — but it has to be measured deliberately, not by accident. GKE keeps every pod warm so the latency you see is steady-state.

## Open design questions

- Cost ceiling. GKE Autopilot is not free. Six pods 24/7 + Postgres ≈ $50–80/mo. Probably worth it for a live demo; cron-job-and-static-snapshot is the fallback.
- Scope of the e-commerce flow: just `/checkout`, or also `/cart/add` and `/products/list`? Starting with just `/checkout`.
- Stress-mode rate limits: per-IP token bucket capped to 50 RPS for 60 seconds, then cooldown.
- Where the frontend lives: own Cloud Run service, not in the cluster.

## Privacy

Repo is private during development; will go public when there's something to show.

## Related

- Portfolio site: [cole-resume-website](https://github.com/CEckelberry/cole-resume-website)
- Infra: [portfolio-iac](https://github.com/CEckelberry/portfolio-iac)
