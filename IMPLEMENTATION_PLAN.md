# Backend Bake-off: Local LLM Implementation Plan

**Status:** Planning | **Date:** 2026-05-06

This document outlines how to implement the entire Backend Bake-off project using your local LLM cluster (gemma4, qwen, etc) via llama-swap API, with Claude Haiku as the orchestration/tracking layer.

---

## Architecture: LLM Division of Labor

### Role of Claude Haiku (This Conversation)
- **Purpose**: Orchestration, progress tracking, decision gates, integration verification
- **Does NOT**: Write implementation code (local LLMs do that)
- **Does**: 
  - Create task specifications in clear natural language
  - Spin up subagents with MCP servers for parallel work
  - Verify integration points between phases
  - Maintain the execution harness and context

### Role of Local LLMs (Specialized Agents)
- **Gemma4**: Backend implementations (Go, Rust) — math/systems-oriented tasks
- **Qwen**: Frontend & TypeScript work (SvelteKit, component logic)
- **Other local models**: Python, PHP, Node backends as needed

**Distribution strategy:**
```
Local LLM Agents (via llama-swap MCP)
├── Agent-Backend-Go
│   └── Gemma4 (systems language, strong in Go)
├── Agent-Backend-Rust
│   └── Gemma4 (memory safety, strong in async)
├── Agent-Backend-Node
│   └── Qwen (JavaScript ecosystem strength)
├── Agent-Backend-Python
│   └── Qwen or Gemma4 (async patterns)
├── Agent-Frontend
│   └── Qwen (SvelteKit, design systems)
└── Agent-Infrastructure
    └── Specialized (Terraform, Kubernetes manifests)
```

Each agent has:
- **Its own MCP server** with bash, file read/write, and HTTP capabilities
- **Persistent context** (pinned docs from METHODOLOGY.md, ARCHITECTURE.md, RUNTIMES.md)
- **Task queue** (CI-style artifact tracking)
- **Output validation** (contract tests, methodology audit)

---

## Phase Overview (11-13 weeks, full v1)

### Phase 0: Foundation (Week 1)
**What**: Repo scaffold, OpenAPI spec, seed data, CI setup
**Who**: Haiku orchestrates, local LLMs build
**Key decision**: This phase blocks everything else. Must be airtight.

### Phase 1: First Backend (Week 1-2)
**What**: Go backend end-to-end (tax service, domain logic, observability)
**Who**: Gemma4 (Agent-Backend-Go)
**Why first**: Template for all others

### Phase 2: Infrastructure (Weeks 2-4)
**What**: GKE, Cloud SQL, Terraform, observability, CI/CD, wake-up controller
**Who**: Agent-Infrastructure (parallel with Phase 1 final week)
**Why parallel**: Lets Phase 3 start immediately

### Phase 3: Remaining v0 (Weeks 4-6)
**What**: Rust + Node backends, contract conformance
**Who**: Gemma4 (Rust), Qwen (Node) in parallel
**Why parallel**: They can both run independently

### Phase 4: Frontend v0 (Weeks 6-8)
**What**: SvelteKit site, live chart, order placement, warmup splash
**Who**: Qwen (Agent-Frontend)
**Blocks**: Phases 5 & 6

### Phase 5: Interactive Features (Week 9)
**What**: Stress mode, comparison, loadgen service
**Who**: Gemma4 (Loadgen), Qwen (UI)
**Blocks**: Phase 6

### Phase 6: Polish (Week 10)
**What**: Perf pass, accessibility, case study, launch
**Who**: Haiku validates, local LLMs execute
**Blocks**: Public launch

### Phase 7: v1 Expansion (Weeks 11-13)
**What**: Bun, Python, PHP backends
**Who**: Specialized agents per language
**Parallel**: All three can run simultaneously

---

## Harness Architecture: How It Works

### 1. Haiku (This Session)
Acts as **task router and progress ledger**:

```
Your prompt
    ↓
Haiku reads METHODOLOGY.md + ARCHITECTURE.md
    ↓
Haiku creates structured task spec
    ↓
Haiku spins up MCP subagent with:
  - Task spec (natural language)
  - Pinned reference docs
  - Validation criteria
  - Success/failure callback URL
    ↓
Local LLM Agent executes
    ↓
Agent reports back (artifact URLs, test results)
    ↓
Haiku verifies against contract + methodology
    ↓
Haiku updates execution ledger
    ↓
Haiku reports to user
```

### 2. Local LLM Agents (Subagents)
Each agent runs with its own tools:
- **bash**: Run tests, compile, push to git
- **read/write**: Access files in its scope
- **http**: Report back to the Haiku harness
- **git**: Version control within the project

**Agent lifecycle:**
```
MCP Init
  ↓
Load pinned docs into context
  ↓
Read task spec
  ↓
Implement (iteratively)
  ↓
Run local tests
  ↓
Report: [PASS] or [FAIL]
  ↓
If [FAIL]: self-correct (attempt N times)
  ↓
Push to feature branch
  ↓
Haiku verifies in CI
```

### 3. Integration Points
- **Git branches per phase**: `phase-0-foundation`, `phase-1-go-backend`, etc.
- **CI runs per task**: contract tests, methodology audit, build verification
- **Artifacts**: Docker images → Artifact Registry, manifests → Git
- **Validation gateway**: Haiku waits for CI to pass before clearing phase

---

## Setup: Get It Running

### 0. Prerequisites (Run Once)
```bash
# Ensure you have these locally
kubectl version  # K8s CLI
gcloud version   # GCP CLI
terraform -v     # Infrastructure as code

# Install llama-swap API and local models (you have this)
# Ensure these are exposed:
# - Gemma4 on http://localhost:8000 (or configure endpoint)
# - Qwen on http://localhost:8001
# - (Add other models as needed)

# Create a .env for the harness
cat > /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/.env <<EOF
LLAMA_SWAP_GEMMA4_URL=http://localhost:8000/v1
LLAMA_SWAP_QWEN_URL=http://localhost:8001/v1
GCP_PROJECT=your-project-id
GKE_CLUSTER=bakeoff-cluster
GKE_REGION=us-west1
EOF
```

### 1. Create MCP Subagent Template
```bash
mkdir -p ~/.config/cline/mcp_servers
```

Create a manifest for each agent (example for Gemma4 backend agent):

```json
{
  "name": "agent-backend-go",
  "model": "llama-via-llama-swap",
  "modelConfig": {
    "baseURL": "http://localhost:8000/v1",
    "model": "gemma4",
    "temperature": 0.3
  },
  "tools": ["bash", "read", "write", "http"],
  "resourceLimits": {
    "maxTokens": 100000,
    "timeout": 3600
  },
  "pinned_docs": [
    "/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/METHODOLOGY.md",
    "/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/ARCHITECTURE.md",
    "/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/RUNTIMES.md"
  ]
}
```

### 2. Initialize Phase 0 Harness
```bash
cd /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff
git init
git checkout -b phase-0-foundation
```

---

## Phase-by-Phase Execution Plan

### Phase 0: Foundation (Week 1)

**Task Spec for Local LLM Agent**

```
TASK: Phase 0 — Foundation (Monorepo + Contract + Schema + CI)

SCOPE:
You have 6 subtasks, each is a git commit:
1. Monorepo scaffold (pnpm workspaces, Makefile, directories)
2. OpenAPI contract (api/openapi.yaml, linting, codegen)
3. Seed data (products.json, migrations, seed.sh)
4. Local docker-compose (all 6 placeholder backends + observability)
5. CI scaffold (.github/workflows/ci.yml, paths filter)
6. Methodology audit script (scripts/audit-methodology.sh)

CONSTRAINTS (DO NOT VIOLATE):
- Every line of METHODOLOGY.md is the law
- The contract MUST pass redocly lint
- The docker-compose MUST bring up all services with `make dev`
- CI MUST fail on methodology violations
- The schema MUST be byte-for-byte identical across all 6 schemas

INPUTS:
- METHODOLOGY.md (pinned: defines what "fair" means)
- ARCHITECTURE.md (pinned: system design)
- RUNTIMES.md (pinned: per-runtime specs)
- README.md (pinned: project overview)

VERIFICATION:
After each subtask:
  1. `make dev` succeeds
  2. Schema has 200 products in each schema
  3. OpenAPI passes `redocly lint`
  4. CI passes on valid inputs, fails on broken manifests
  5. Commit message follows: "phase-0.X: [task name]"

SUCCESS:
- All 6 subtasks committed to phase-0-foundation branch
- `git log --oneline` shows 6 commits
- CI passes on every commit
- No TODOs or FIXMEs left in code
```

**Haiku's role**: Create this spec, send to Agent-Foundation (any capable local LLM). Wait for branch to be ready. Review by running CI. If CI fails, ask the agent to fix and re-run.

---

### Phase 1: Go Backend (Weeks 1-2)

**Parallel execution** (Phase 0 completes, Phase 1 starts immediately)

```
TASK: Phase 1 — Go Backend (Tax Service + Domain + Observability)

SUBTASKS:
1. Task 1.1: Tax service (POST /tax endpoint, ~50 lines)
2. Task 1.2: Go backend skeleton (chi setup, pgxpool, health endpoint)
3. Task 1.3: Domain logic + database (POST /checkout, validation, DB)
4. Task 1.4: Tax client + fraud function (orchestration)
5. Task 1.5: Observability (metrics, traces, logs)
6. Task 1.6: Contract conformance test
7. Task 1.7: Router service

CONSTRAINTS:
- Every implementation MUST match RUNTIMES.md exactly
- HTTP latency p95 must be 60-100ms (fraud function is ~50ms)
- No business logic in handlers; domain logic is pure
- All metrics use canonical names from ARCHITECTURE.md

VERIFICATION:
- `curl localhost:8081/health` returns 200
- `curl -X POST localhost:8081/checkout -d @example.json` returns 201
- Prometheus at localhost:9090 shows metrics from all three services
- Contract tests pass: `bash tests/contract/run.sh http://localhost:8081`
- Dockerfile size < 20MB

SUCCESS:
- All 7 subtasks in phase-1-go-backend branch
- `make dev` brings up Go + tax service + router all working
- 0 test failures
- Ready for Phase 2 infrastructure work
```

**Haiku's role**: 
1. Create spec, send to Gemma4 agent
2. Monitor agent's progress (it should report back after each subtask)
3. Once all subtasks report [PASS], merge phase-1-go-backend → main
4. Start Phase 2 infrastructure work (can run in parallel)

---

### Phase 2: Infrastructure (Weeks 2-4)

**Parallel with Phase 1 final days**

```
TASK: Phase 2 — Infrastructure (Terraform + Helm + CI/CD + Wake-up)

SUBTASKS:
1. Terraform: VPC, GKE, Cloud SQL
2. Terraform: IAM, Workload Identity, Artifact Registry
3. Helm chart for backends
4. In-cluster observability (Prometheus, Grafana, OTel)
5. Cloud Run for frontend, router, loadgen
6. CI: build and deploy (GitHub Actions)
7. First end-to-end deploy (Go backend to GKE)
8. Wake-up controller (Cloud Function)
9. Idle watcher + sleep
10. Budget cap automation

CONSTRAINTS:
- All resource specs MUST match METHODOLOGY.md
- No co-tenancy on backend nodes (PodAntiAffinity strict)
- Wake-up latency: < 90 seconds total
- Cost target: < $110/month at design traffic

VERIFICATION:
- `kubectl get pods -n bakeoff` shows all deployments
- `curl https://bakeoff.ce.dev/api/health?rt=go` returns 200
- Prometheus has live metrics from Go backend
- Cost dashboard shows < $5/day
- Wake-up takes 60-90s, cluster sleeps after 15min idle

SUCCESS:
- GKE cluster fully operational
- Go backend deployed and reachable from the internet
- CI/CD pipeline building and deploying on git push
- Cost automation in place
```

**Haiku's role**:
1. Create Terraform spec, send to Agent-Infrastructure
2. Verify each resource with `gcloud` / `kubectl` as they're created
3. Smoke test after first deploy: hit the live endpoint, check Cloud SQL
4. Track infrastructure costs hourly
5. Gate Phase 3 behind successful deploy

---

### Phase 3: Remaining v0 Backends (Weeks 4-6)

**Parallel execution** (Rust + Node simultaneously)

```
TASK: Phase 3.A — Rust Backend

SUBTASKS (same pattern as Go):
1. Skeleton + observability
2. Domain logic, DB, tax, fraud
3. Contract conformance
4. Deploy to GKE

CONSTRAINTS:
- Must match RUNTIMES.md exactly
- p95 latency < 60ms (should be faster than Go)
- Container size < 30MB

---

TASK: Phase 3.B — Node Backend

SUBTASKS (same pattern as Go):
1. Skeleton + observability
2. Domain logic, DB, tax, fraud
3. Contract conformance
4. Deploy to GKE

CONSTRAINTS:
- Must match RUNTIMES.md exactly
- p95 latency 80-150ms
- Container size < 100MB
```

**Haiku's role**:
1. Spec both tasks simultaneously
2. Send Rust spec to Gemma4 agent
3. Send Node spec to Qwen agent
4. Monitor both in parallel (they work independently)
5. Once both report [PASS], run contract tests against all 3 backends
6. Methodology audit must pass
7. Merge both → main

---

### Phase 4: Frontend (Weeks 6-8)

```
TASK: Phase 4 — SvelteKit Frontend

SUBTASKS:
1. Project init + design tokens
2. Layout shell + page structure
3. Live metrics chart
4. Runtime tabs + real data wiring
5. Place-an-order panel + real checkout
6. Order result + timing breakdown
7. Methodology badge + modal
8. Mobile adaptations
9. Warmup splash + wake-up gate

CONSTRAINTS:
- All colors from DESIGN.md
- Chart updates every 2s without flashing
- Warmup splash is on-brand, honest about wait time
- Mobile: fully functional at 375px width

VERIFICATION:
- `pnpm --filter web dev` starts dev server
- Live chart shows real data from Prometheus
- Clicking "place order" creates a real order in the DB
- Warmup splash appears when cluster is asleep
- Lighthouse Mobile Performance ≥ 90
```

**Haiku's role**:
1. Spec frontend tasks in detail (reference DESIGN.md heavily)
2. Send to Qwen agent
3. Review component code for design token usage
4. Run Lighthouse on live deployment
5. Gate Phase 5 behind accessibility passing

---

### Phase 5: Interactive Features (Week 9)

```
TASK: Phase 5.A — Loadgen Service

SUBTASKS:
1. Loadgen service (Go)
2. Stress slot mechanism in router
3. Cloud Scheduler integration

---

TASK: Phase 5.B — Stress + Comparison UI

SUBTASKS:
1. Stress mode UI components
2. Comparison mode UI components
3. Daily quota tracking
```

**Haiku's role**:
1. Spec loadgen (Gemma4 agent)
2. Spec UI (Qwen agent)
3. Run stress tests manually to verify behavior
4. Verify cost doesn't spike unexpectedly

---

### Phase 6: Polish + Launch (Week 10)

```
TASK: Phase 6 — Polish + Case Study

SUBTASKS:
1. Performance pass (Lighthouse 95+)
2. Accessibility pass (axe-core 0 violations)
3. SEO + Open Graph
4. Write case study
5. Verify methodology audit timestamp
6. Public launch + monitoring
```

**Haiku's role**:
1. Coordinate final polish
2. Write case study (or coordinate with Qwen for writing)
3. Final validation: methodology audit passes
4. Deploy to production
5. Monitor for 24 hours before considering "shipped"

---

### Phase 7: v1 Expansion (Weeks 11-13)

```
TASK: Phase 7.A — Bun Backend
TASK: Phase 7.B — Python Backend
TASK: Phase 7.C — PHP Backend

All three can run in parallel.
Each follows the same pattern as Phase 3 (skeleton → logic → contract → deploy).

CONSTRAINTS:
- Python: 4 Uvicorn workers (called out in METHODOLOGY)
- PHP: 4 RoadRunner workers
- Bun: single process
```

**Haiku's role**:
1. Spec all three in parallel
2. Route to appropriate agents
3. Monitor completion
4. Merge all → main

---

## Success Metrics & Decision Gates

### After Phase 0
- [ ] CI passes on all commits
- [ ] `make dev` brings up 9 services cleanly
- [ ] OpenAPI schema is valid
- [ ] Repo is ready for distributed work

### After Phase 1
- [ ] Go backend fully functional
- [ ] 0 contract violations
- [ ] p95 latency measured at 60-100ms
- [ ] All observability outputs working

### After Phase 2
- [ ] GKE cluster operational
- [ ] Go backend deployed and reachable
- [ ] CI/CD pipeline proven (at least 2 deployments)
- [ ] Cost tracking verified
- [ ] Wake-up/sleep choreography working

### After Phase 3
- [ ] All 3 v0 backends (Go, Rust, Node) deployed
- [ ] Contract tests pass against all 3
- [ ] Methodology audit passes
- [ ] Relative latency makes sense (Rust < Go < Node)
- [ ] Live dashboard shows all 3 backends

### After Phase 4
- [ ] Site fully functional (no placeholders)
- [ ] Live chart updates every 2s
- [ ] Warmup splash works
- [ ] Lighthouse Performance ≥ 90
- [ ] Site links from portfolio

### After Phase 5
- [ ] Stress mode works (RPS slider)
- [ ] Comparison mode works
- [ ] Quota enforcement working
- [ ] Cost stays under $150/month

### After Phase 6
- [ ] Lighthouse 95+ on all pages
- [ ] axe-core 0 violations
- [ ] Case study published
- [ ] Site launched publicly

### After Phase 7
- [ ] All 6 backends live
- [ ] v1 case study updated
- [ ] Cost stays under $150/month
- [ ] Ready for v2

---

## Risk Mitigation

### Risk: Local LLM hallucinates infra commands
**Mitigation**: 
- Have the agent run commands locally in `docker-compose` first
- Use `terraform plan` before `terraform apply`
- Every agent action is dryrun-validated before execution

### Risk: Phase dependencies break (e.g., Phase 4 blocked waiting for Phase 2)
**Mitigation**:
- Design phases for maximum parallelism
- Use mock APIs in frontend dev (Haiku can provide fake Prometheus endpoint)
- Phase 4 can start before Phase 2 is complete with stubs

### Risk: LLM model fails partway through a phase
**Mitigation**:
- Each subtask is atomic (a git commit)
- If an agent fails, Haiku rolls back the branch and tries again with a different model
- Model A fails → retry with Model B (or ask Haiku to help)

### Risk: Cost overruns during infrastructure testing
**Mitigation**:
- Phase 2 uses `--dry-run` for Terraform + `kubectl apply --dry-run=server`
- First real GKE cluster only spun up after Haiku manual approval
- Budget automation (Task 2.10) is deployed in Phase 2 itself

### Risk: Contract violations introduced by v1 backends
**Mitigation**:
- Contract test runs before every deploy
- Methodology audit runs in CI
- Manual spot-check: Haiku hits a few endpoints on each new backend

---

## Next Steps (After This Planning Session)

1. **Haiku creates Phase 0 task spec** (very detailed, 5-7K words)
2. **User spins up first MCP subagent** (the Foundation agent)
3. **Agent executes Phase 0** (this may take 1-2 days for a local LLM)
4. **Haiku validates** Phase 0 outputs and merges to main
5. **Parallelize**: 
   - Phase 1 Go backend (Gemma4 agent)
   - Phase 2 Infrastructure (second agent)
6. **Continue phasing through to launch**

Each phase gate is **Haiku's decision**, not an automatic merge. Haiku reviews artifacts, runs CI, checks costs, and gives the go-ahead.

---

## LLM Model Assignment (Recommended)

| Phase | Task | Model | Reasoning |
|---|---|---|---|
| 0 | Foundation | Any | Straightforward templating |
| 1 | Go backend | Gemma4 | Systems-oriented, strong in Go |
| 2 | Infrastructure | Any (IaC-capable) | Terraform, YAML, bash |
| 3.A | Rust backend | Gemma4 | Memory safety, async patterns |
| 3.B | Node backend | Qwen | JavaScript ecosystem strength |
| 4 | Frontend | Qwen | SvelteKit, design systems, TypeScript |
| 5.A | Loadgen | Gemma4 | Go, load testing, parallelism |
| 5.B | Stress/Compare UI | Qwen | Frontend components |
| 6 | Polish | Qwen (frontend), Gemma4 (perf) | Mixed |
| 7.A | Bun | Qwen | JavaScript runtime |
| 7.B | Python | Qwen or Gemma4 | Async, FastAPI |
| 7.C | PHP | Qwen or Gemma4 | Laravel, RoadRunner |

---

## Success = Shipped

When you can:
1. **Navigate to** `https://bakeoff.ce.dev/`
2. **See live latency** for all 6 backends
3. **Click a tab** and **place an order** against a different backend
4. **Click "compare"** and see two responses side-by-side
5. **Run stress mode** and watch the live chart spike
6. **Read the methodology badge** and understand the fairness rules
7. **Open the GitHub repo** and review the implementation

...then you've shipped a portfolio project that:
- Demonstrates systems thinking (Kubernetes, observability, cost optimization)
- Showcases six languages (Go, Rust, Bun, Node, Python, PHP)
- Embodies methodology rigor (the Methodology doc is the credibility anchor)
- Invites interaction (people will play with the stress slider)
- Tells a story (the case study)

**That's a project worth the 11-13 weeks.**

---

## Questions for You

Before we kick off Phase 0:

1. **Do you want to start with Phase 0 immediately?** (I can create the detailed task spec now)
2. **Which local model feels strongest to you for backend work?** (I'll route Go tasks there)
3. **Do you have kubectl + gcloud ready locally, or should we set those up first?**
4. **Should we run the full 6-backend v1, or start with v0 (3 backends) to get to "shipped" faster?**
5. **Is there a GCP project ready, or should Phase 2 set one up?**

Once you answer, I'll create the Phase 0 task spec and we can spin up the first subagent.

