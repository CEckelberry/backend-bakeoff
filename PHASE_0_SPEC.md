# Phase 0 Task Specification: Foundation

**Status:** Ready for Agent Execution  
**Assigned Model:** lisaria-architect (Gemma4-31B)  
**API Endpoint:** http://localhost:8080/v1  
**Execution Model:** Serial (one subtask at a time)  
**Difficulty:** Medium (boilerplate + validation)  
**Estimated Duration:** 1-2 days (per local LLM speed)

---

## Executive Summary

Phase 0 is the **foundation layer**. You will create the monorepo structure, define the OpenAPI contract, seed the database schema, set up local development infrastructure, wire the CI pipeline, and build the methodology audit script.

**Success condition:** After Phase 0 completes, a single `make dev` command brings up 9 services (Postgres, 6 backend placeholders, tax service placeholder, router placeholder, Prometheus, Grafana) with zero errors.

---

## Context: What You're Building

This is the **Backend Bake-off** project:
- An interactive benchmark comparing 6 backend runtimes (Go, Rust, Bun, Node, Python, PHP) running the same e-commerce checkout endpoint
- All backends run side-by-side on Kubernetes with identical methodology
- A live web UI lets visitors pick a runtime, place orders, stress-test, and compare latencies
- The goal is to demonstrate systems thinking, breadth across languages, and methodology rigor

**Phase 0's role:** Create the blank canvas and the rules. No business logic yet. Just structure, contracts, validation, and CI.

---

## Key Constraints (DO NOT VIOLATE)

1. **Methodology is law.** Every line of METHODOLOGY.md is non-negotiable. Read it first.
2. **The contract is the source of truth.** The OpenAPI spec (api/openapi.yaml) defines what every backend must implement. No deviations.
3. **Schema consistency.** All 6 database schemas (bakeoff_go, bakeoff_rust, etc.) must be byte-for-byte identical in structure.
4. **CI must pass.** Every commit must pass linting, schema validation, and audit checks. No TODO/FIXME left behind.
5. **`make dev` is gospel.** The command must bring everything up cleanly. If it doesn't, the phase fails.

---

## Pinned Reference Documents

Read these before starting any subtask. They are **the law**:

- **METHODOLOGY.md** — Fairness rules. What is "identical hardware" and why it matters.
- **ARCHITECTURE.md** — System design. What all 6 backends do, how they connect, where they run.
- **RUNTIMES.md** — Per-backend specs. Exact framework choices, dependency lists, Dockerfile patterns.
- **DESIGN.md** — UX/visual language (not needed for Phase 0, but reference for completeness).
- **README.md** — Project overview. The "why" behind all this work.

If a subtask contradicts any of these documents, **the document wins**. Flag it to the human for clarification.

---

## Phase 0 Subtasks (6 Total)

Each subtask is a git commit. Each commit must pass CI. Do not merge subtasks; leave them as separate commits so the human can inspect them.

### Subtask 0.1: Monorepo Scaffold

**Goal:** Create the directory structure and root-level files that make this a valid monorepo with pnpm workspaces.

**Inputs:**
- README.md (see "Repository layout" section)
- ARCHITECTURE.md (component list)

**Outputs:**
- `pnpm-workspace.yaml` at root
- `package.json` at root with workspace configuration
- `Makefile` at root with targets: `make dev`, `make clean-dev`, `make build`, `make test`, `make bench`
- `.gitignore` (standard Node/Go/Rust/Python/PHP patterns)
- `.editorconfig` (standard: 2 spaces, LF, UTF-8)
- `LICENSE` file (MIT)
- Directory tree per README.md:
  ```
  backend-bakeoff/
  ├── api/
  ├── apps/
  │   ├── web/
  │   ├── router/
  │   ├── loadgen/
  │   ├── tax-service/
  │   └── backends/
  │       ├── go/
  │       ├── rust/
  │       ├── bun/
  │       ├── node/
  │       ├── python/
  │       └── php/
  ├── packages/
  │   ├── contracts/
  │   └── seed-data/
  ├── infra/
  │   ├── terraform/
  │   ├── k8s/
  │   └── observability/
  └── tests/
      └── contract/
  ```

**Acceptance Criteria:**
- `pnpm install` at root succeeds with no errors
- `ls -la` shows all directories created (no symlinks needed at this stage)
- `cat pnpm-workspace.yaml` shows `packages:` list with all 9 workspaces (web, router, loadgen, tax-service, go, rust, bun, node, python, php)
- `make dev` exists and prints "Foundation not yet ready. See QUICKSTART.md" (stub, not functional yet)
- `make clean-dev` exists
- `.editorconfig` is present and valid

**Commit Message:**
```
phase-0.1: monorepo scaffold with pnpm workspaces and Makefile

- Create pnpm-workspace.yaml with all 9 app packages
- Root package.json for shared scripts
- Makefile stubs for dev/build/test/bench
- Standard .gitignore and .editorconfig
- Full directory tree per README.md layout
```

---

### Subtask 0.2: OpenAPI Contract

**Goal:** Define the API contract in OpenAPI 3.1 format. This is the **source of truth** for all backends.

**Inputs:**
- METHODOLOGY.md (Workload definition section, Fraud function section)
- RUNTIMES.md (cross-runtime requirements section)

**Outputs:**
- `api/openapi.yaml` with:
  - **POST /checkout** endpoint with full request and response schemas
  - **GET /health** endpoint with response schema
  - All shared types in `components/schemas`
  - Detailed descriptions and examples for every field
  - Example requests/responses for:
    - Valid order (3-5 items)
    - Empty cart (should return 422)
    - 9-item cart (should return 400, too large)
    - Malformed JSON (should return 400)
    - Missing required field (should return 422)
    - Unknown product ID (should return 422)
    - Out-of-stock product (should return 422)

- `api/README.md` explaining:
  - How to generate server stubs from this spec (`openapi-generator`, `oapi-codegen`, language-specific tools)
  - Where to find the spec
  - Link to Swagger UI for browsing

- `Makefile` target: `make contract` runs `redocly lint api/openapi.yaml` (you may need to `npm install -g redocly`)

**Contract Schema Details:**

```yaml
POST /checkout
  Request:
    body:
      type: object
      required: [cart, shipping_address, customer_id]
      properties:
        cart:
          type: array
          items:
            type: object
            required: [product_id, quantity]
            properties:
              product_id: { type: string, format: uuid }
              quantity: { type: integer, minimum: 1, maximum: 8 }
          minItems: 1
          maxItems: 8
        shipping_address:
          type: object
          required: [country, postal_code]
          properties:
            country: { type: string, minLength: 2, maxLength: 2 }  # ISO 3166-1 alpha-2
            postal_code: { type: string }
        customer_id: { type: string, format: uuid }

  Responses:
    201 Created:
      body:
        type: object
        properties:
          order_id: { type: string, format: uuid }
          total_cents: { type: integer, minimum: 0 }
          tax_cents: { type: integer, minimum: 0 }
          items: 
            type: array
            items:
              type: object
              properties:
                product_id: { type: string, format: uuid }
                product_name: { type: string }
                quantity: { type: integer }
                price_cents: { type: integer }
          created_at: { type: string, format: date-time }
    400 Bad Request:
      body:
        type: object
        properties:
          error: { type: string }
          details: { type: object }
    422 Unprocessable Entity:
      body:
        type: object
        properties:
          error: { type: string }
          details: { type: object }
    500 Internal Server Error:
      body:
        type: object
        properties:
          error: { type: string }

GET /health
  Responses:
    200 OK:
      body:
        type: object
        properties:
          status: { type: string, enum: ["ok", "degraded"] }
          runtime: { type: string }  # "go", "rust", "bun", etc.
    503 Service Unavailable:
      body:
        type: object
        properties:
          status: { type: string, enum: ["degraded"] }
          runtime: { type: string }
```

**Acceptance Criteria:**
- `make contract` runs without errors
- OpenAPI file is valid (passes `redocly lint`)
- All response codes are documented (200, 201, 400, 422, 500, 503)
- All schemas have descriptions
- At least 3 example requests in the spec
- At least 3 example responses
- The spec is in `api/openapi.yaml` (not `openapi.json`)

**Commit Message:**
```
phase-0.2: OpenAPI contract (POST /checkout, GET /health)

- api/openapi.yaml with full request/response schemas
- Examples for valid and error cases
- Contract is the source of truth for all backends
- All 6 runtimes must implement this exactly
- Passes redocly lint with zero errors
```

---

### Subtask 0.3: Seed Data and Database Schema

**Goal:** Create the canonical product catalog and database DDL (Data Definition Language). All 6 backends will use identical schemas.

**Inputs:**
- METHODOLOGY.md (Database section)
- ARCHITECTURE.md (Database section)

**Outputs:**
- `packages/seed-data/products.json` — 200 products with realistic shape:
  ```json
  [
    {
      "id": "uuid",
      "sku": "PROD-001",
      "name": "Wireless Headphones",
      "price_cents": 9999,
      "stock": 42,
      "created_at": "2025-01-01T00:00:00Z"
    },
    ...
  ]
  ```

- `packages/seed-data/migrations/001_init.sql` — Creates 6 schemas with identical DDL:
  - Schema names: `bakeoff_go`, `bakeoff_rust`, `bakeoff_bun`, `bakeoff_node`, `bakeoff_python`, `bakeoff_php`
  - Tables in each schema:
    - `products` (id, sku, name, price_cents, stock, created_at)
    - `orders` (id, customer_id, total_cents, tax_cents, created_at)
    - `order_items` (id, order_id, product_id, quantity, price_cents, created_at)
  - Indexes: on `orders.created_at`, `order_items.order_id`, `products.id`
  - Constraints: `NOT NULL` on required fields, `FOREIGN KEY` order_items → orders, FK order_items → products

- `packages/seed-data/migrations/002_seed.sql` — Inserts 200 products into all 6 schemas

- `packages/seed-data/seed.sh` — Shell script that:
  - Takes `$DATABASE_URL` as an env var
  - Runs migrations using `psql` (assumes Postgres)
  - Reports success/failure clearly
  - Example: `bash packages/seed-data/seed.sh postgresql://user:pass@localhost/testdb`

- `packages/seed-data/README.md` — Explains:
  - How to run the seed script
  - Schema isolation strategy (6 schemas, one per backend, on same instance)
  - Product catalog size (200 items)
  - DDL is byte-for-byte identical across all schemas

**Acceptance Criteria:**
- `products.json` has exactly 200 entries with realistic product names (clothing, electronics, etc.)
- DDL is identical across all 6 schemas (can verify with a diff script)
- `seed.sh` script is executable and documented
- Running `seed.sh` against a local Postgres creates all 6 schemas
- `SELECT count(*) FROM bakeoff_go.products` returns 200
- Same count for all 6 schemas
- Foreign keys are set up correctly (can't delete a product that has orders)
- Script exits 0 on success, non-zero on failure

**Commit Message:**
```
phase-0.3: database schema and seed data for all 6 backends

- packages/seed-data/products.json (200 realistic products)
- 001_init.sql creates 6 identical schemas (bakeoff_go through bakeoff_php)
- 002_seed.sql inserts products into all schemas
- seed.sh script to run migrations
- Schemas are isolated (no data mixing), DDL is identical
```

---

### Subtask 0.4: Local Development Docker Compose

**Goal:** Create `docker-compose.yml` that brings up all 9 services for local development. The command `make dev` should run `docker compose up --build`.

**Inputs:**
- ARCHITECTURE.md (Component list, Network section)
- All previous subtasks' outputs

**Outputs:**
- `docker-compose.yml` at root with services:
  - **db** — `postgres:18-alpine`, port 5432, volume `data/db`
  - **db-init** — one-shot job running `packages/seed-data/seed.sh` (waits for db, then exits)
  - **tax-service** — placeholder Go service (listens 8087, returns 200 on `/health`, hardcoded on `/tax`)
  - **bo-go**, **bo-rust**, **bo-bun**, **bo-node**, **bo-python**, **bo-php** — 6 placeholder backends
    - Each listens on 8081-8086
    - Each has `/health` returning 200
    - Each has `/metrics` returning basic Prometheus output (can be hardcoded for now)
  - **router** — placeholder Go service (listens 8090, proxies based on `X-Runtime` header)
  - **prometheus** — `prom/prometheus:latest`, listens 9090, scrapes all backends
  - **grafana** — `grafana/grafana:latest`, listens 3001 (admin/admin), has one simple dashboard

- `infra/observability/prometheus-local.yml` — Prometheus scrape config:
  ```yaml
  global:
    scrape_interval: 5s
  scrape_configs:
    - job_name: backends
      static_configs:
        - targets: ['bo-go:8080', 'bo-rust:8080', ..., 'tax-service:8080']
          labels:
            group: 'backend'
    - job_name: router
      static_configs:
        - targets: ['router:8080']
  ```

- Placeholder Dockerfiles for each service (can use `FROM alpine`, copy a stub binary, expose port)

- `Makefile` target: `make dev` runs `docker compose up --build`

- `Makefile` target: `make dev-clean` runs `docker compose down -v`

**Acceptance Criteria:**
- `make dev` brings up all 9 services within 2 minutes (first build)
- All services show "started" in logs
- `curl http://localhost:8081/health` returns 200 (bo-go)
- Same for bo-rust (8082), bo-bun (8083), bo-node (8084), bo-python (8085), bo-php (8086)
- `curl http://localhost:8087/health` returns 200 (tax-service)
- `curl http://localhost:8090/health` returns 200 (router)
- `curl http://localhost:9090/-/healthy` returns 200 (Prometheus)
- `curl http://localhost:3001/api/health` returns 200 (Grafana)
- `docker compose ps` shows all 9 containers as UP
- `make dev-clean` stops and removes all containers and volumes
- Re-running `make dev` starts fresh
- Logs are clear (no errors in startup phase)

**Commit Message:**
```
phase-0.4: local docker-compose with 9 services

- db (Postgres 18), db-init job (runs seed script)
- 6 backend placeholders (bo-go through bo-php)
- tax-service, router, prometheus, grafana
- All services listen on distinct ports (5432, 8081-8090, 9090, 3001)
- `make dev` brings everything up cleanly
- `make dev-clean` tears down completely
```

---

### Subtask 0.5: CI Scaffold

**Goal:** Create `.github/workflows/ci.yml` that validates Phase 0 outputs and runs basic checks on every push.

**Inputs:**
- METHODOLOGY.md (locked values that CI must enforce)
- All previous subtasks

**Outputs:**
- `.github/workflows/ci.yml` with jobs:
  - **Lint OpenAPI** — runs `npx redocly lint api/openapi.yaml`
  - **Validate schema** — custom script that ensures all 6 schemas in migrations are byte-for-byte identical
  - **Test docker-compose** — runs `docker compose up --build` and waits 30s, then checks all services are responding
  - **Methodology audit** — runs the audit script from Subtask 0.6
  - All jobs run on every push to any branch
  - Fail fast if any job fails

- `.github/workflows/README.md` explaining:
  - What secrets the workflow will need later (filled in Phase 2)
  - How to add new jobs
  - How to debug a failed workflow

**Acceptance Criteria:**
- `.github/workflows/ci.yml` syntax is valid (passes `actionlint`)
- A push to a branch triggers CI automatically
- CI passes on a clean Phase 0 commit
- CI fails if `api/openapi.yaml` has lint errors (test by adding a known error, committing, seeing failure)
- All job names are clear and descriptive
- Workflow has a name: "Phase 0: Foundation"

**Commit Message:**
```
phase-0.5: CI scaffold for automated validation

- GitHub Actions workflow: ci.yml
- Lint OpenAPI contract
- Validate database schemas
- Test docker-compose startup
- Runs methodology audit
- Fails fast on any validation error
```

---

### Subtask 0.6: Methodology Audit Script

**Goal:** Create a script that runs in CI and enforces the methodology rules. This prevents drifts before they reach production.

**Inputs:**
- METHODOLOGY.md (the locked values that must never change)

**Outputs:**
- `scripts/audit-methodology.sh` (or `.go` if you prefer) that validates:
  - All 6 database schemas have identical DDL (can use `pg_dump -s` and diff)
  - All 6 backend services are listening on the expected ports
  - Docker-compose brings up exactly 9 services
  - No TODO or FIXME comments left in production files (optional, but good practice)
  - OpenAPI contract doesn't define any endpoints besides `/checkout` and `/health`
  - All required files exist: `api/openapi.yaml`, `packages/seed-data/products.json`, `docker-compose.yml`, `Makefile`

- `scripts/audit-test/` directory with deliberately-broken examples:
  - A malformed DDL migration (one schema missing a column)
  - A docker-compose.yml with wrong port mapping
  - An OpenAPI spec with an extra endpoint
  - Each broken example should cause the audit to fail

- `scripts/audit-test/run-audit-tests.sh` that:
  - Copies a broken example over the real file
  - Runs the audit
  - Checks that it fails (exit code non-zero)
  - Restores the original file
  - Reports pass/fail for each test case

- `scripts/README.md` explaining:
  - What the audit does
  - How to run it locally: `bash scripts/audit-methodology.sh`
  - How to add new audit rules
  - Why each rule matters (link back to METHODOLOGY.md)

**Acceptance Criteria:**
- Audit passes on clean Phase 0 (all 6 subtasks as committed)
- Audit fails if one schema is missing a column (detect with pg_dump diff or grep)
- Audit fails if docker-compose is misconfigured
- Audit fails if OpenAPI has extra endpoints
- Audit test suite runs and reports pass/fail for each case
- Script is executable: `bash scripts/audit-methodology.sh`
- Exit code 0 on pass, non-zero on fail
- Output is clear (not cryptic error messages)

**Commit Message:**
```
phase-0.6: methodology audit script for CI validation

- scripts/audit-methodology.sh enforces locked methodology rules
- Validates schema consistency, service setup, contract
- Runs in CI before every deploy
- scripts/audit-test/ has test cases for broken inputs
- Prevents drift without requiring human review
```

---

## Git Workflow (Important)

1. **Initialize repo:**
   ```bash
   cd /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff
   git init
   git checkout -b phase-0-foundation
   ```

2. **After each subtask:**
   ```bash
   git add -A
   git commit -m "phase-0.X: [commit message from spec]"
   ```

3. **Do NOT merge** yet. Leave all 6 commits on `phase-0-foundation` branch.

4. **Each commit must pass CI** (when CI is wired). If a commit fails, fix and amend:
   ```bash
   git add -A
   git commit --amend --no-edit
   ```

5. **When all 6 subtasks are done:**
   ```bash
   git log --oneline | head -10
   # Should show 6 phase-0.X commits
   ```

6. **Human (Haiku) will review, run final tests, then merge to main.**

---

## Success Criteria: Phase 0 Complete

After all 6 subtasks are committed and passing CI:

- ✅ `make dev` brings up 9 services without errors
- ✅ `curl http://localhost:8081/health` returns 200
- ✅ All 6 backends respond on ports 8081-8086
- ✅ Tax service responds on 8087
- ✅ Router responds on 8090
- ✅ Prometheus is scraping all backends on 9090
- ✅ Grafana is reachable on 3001
- ✅ Database has 200 products in all 6 schemas
- ✅ OpenAPI spec passes linting
- ✅ Methodology audit passes
- ✅ All 6 commits present with clear messages
- ✅ No TODO/FIXME in committed code
- ✅ `make dev-clean` removes everything cleanly
- ✅ Fresh `make dev` starts from scratch without issues

---

## If You Get Stuck

1. **Read the constraint docs first**: METHODOLOGY.md, ARCHITECTURE.md, RUNTIMES.md
2. **Check the examples**: Look at the README.md "Repository layout" section for exact file structure
3. **Docker errors?** Make sure all services have unique ports. Check `docker compose logs <service>` for error details.
4. **Database won't init?** Ensure the seed script has correct `$DATABASE_URL`. Test locally first: `psql $DATABASE_URL -c "\dt"` 
5. **OpenAPI validation fails?** Use `redocly lint api/openapi.yaml --format=json` to see detailed errors
6. **CI won't pass?** Check the GitHub Actions log for which job failed. Each job has clear error messages.

If you're truly stuck on a subtask, flag it and ask the human to clarify.

---

## Model Configuration

For execution with llama-swap:

```json
{
  "model": "lisaria-architect",
  "api_endpoint": "http://localhost:8080/v1",
  "temperature": 0.3,
  "top_p": 0.95,
  "max_tokens": 8192
}
```

**Reasoning:** Gemma4 is deterministic (temp 0.3) and strong at structured task generation (like scaffold code). It will produce consistent, boilerplate-heavy output suitable for Phase 0.

---

## Execution Notes

- **No novel architecture here.** You're following a spec (README.md "Repository layout"). Copy-paste and adapt as needed.
- **Boilerplate is 80% of this phase.** Makefile, docker-compose, .gitignore, etc. are templates.
- **Validation is 20%.** Make sure CI passes and `make dev` works.
- **Take your time.** There's no rush. Get Phase 0 right; everything else depends on it.

---

## Next Phase Gate

Once Phase 0 is complete and all CI passes, the human (Haiku) will:
1. Clone the repo
2. Run `make dev` locally
3. Verify all 9 services start
4. Review the 6 commits
5. Run the methodology audit
6. Merge to main
7. Create Phase 1 task spec (Go backend)

You won't start Phase 1 until Phase 0 is approved.

---

## Deliverables Checklist

- [ ] Subtask 0.1: Monorepo scaffold + Makefile
- [ ] Subtask 0.2: OpenAPI contract (api/openapi.yaml)
- [ ] Subtask 0.3: Database schema + seed data
- [ ] Subtask 0.4: docker-compose.yml with 9 services
- [ ] Subtask 0.5: GitHub Actions CI workflow
- [ ] Subtask 0.6: Methodology audit script
- [ ] All 6 commits on `phase-0-foundation` branch
- [ ] `make dev` works cleanly (brings up all 9 services)
- [ ] `make contract` passes (OpenAPI linting)
- [ ] Methodology audit passes
- [ ] No untracked files or uncommitted changes
- [ ] Ready for human review and merge

---

**Phase 0 is the foundation. Get it right, and everything else builds on it.**

**You've got this. Let's go.**

