# Backend Bake-off: Quick Start Checklist

**Goal**: Get Phase 0 (Foundation) started within the hour.

---

## Pre-Flight Checks (5 minutes)

- [ ] You have access to local models via llama-swap (Gemma4, Qwen, etc) on known ports
- [ ] `kubectl` is installed locally and can reach a cluster (or will be installed for Phase 2)
- [ ] `gcloud` CLI is installed (will be needed in Phase 2)
- [ ] `git` is ready in the project directory
- [ ] You have a GCP project ID ready (for Phase 2; Phase 0 doesn't need it)

```bash
# Quick verify
which kubectl gcloud git
# Should all return paths

# Check local LLM endpoints (if you know them)
curl http://localhost:8000/v1/models  # Gemma4
curl http://localhost:8001/v1/models  # Qwen
# Should return available models
```

---

## What Happens Now (Next 30 minutes)

1. **Haiku (me) creates the Phase 0 task specification** (detailed, ~5-7K words)
2. **You choose: kick off the first subagent or iterate on the plan first?**
   - Option A: "Let's go, spin up the Foundation agent"
   - Option B: "Wait, I have questions / want to refine the plan"
3. **If Option A**: Subagent executes Phase 0 locally (1-2 days on local LLM)
4. **Result**: A Git branch with 6 commits, CI passing, ready for Phase 1

---

## Key Decisions Before We Start

Answer these **now** so there are no blockers:

### 1. Scope: v0 or v1?
- **v0** (3 backends: Go, Rust, Node) = ~7 weeks, ships faster, still impressive
- **v1** (6 backends: add Bun, Python, PHP) = ~11-13 weeks, more comprehensive

**Recommendation**: Start v0, ship that (4 weeks to live site), then v1 (3 more weeks). You get the portfolio win earlier, plus you learn from v0 before v1.

**Your call**: v0 or v1? 

**Answer**: v1 please

### 2. GCP Project
- **Already have one**: You'll provide the project ID in Phase 2
- **Don't have one**: Create one now (free tier is enough for this project)
  ```bash
  gcloud projects create bakeoff-demo --name="Backend Bakeoff"
  gcloud config set project bakeoff-demo
  gcloud billing projects link bakeoff-demo --billing-account=YOUR_ACCOUNT_ID
  ```

**Your call**: Do you have a GCP project ready?

**Answer**: I have a GCP project ready, but we should focus on local development only for now. I have quite a beastly machine so not worried about resources. 

### 3. Local LLM Models
The plan assumes:
- **Gemma4** for backend work (Go, Rust, load testing)
- **Qwen** for frontend (SvelteKit, UI)

If your local setup is different, let me know and I'll adjust routing.

**Your setup**: Which models are available at which endpoints?

### 4. Work Parallelism
The plan shows **max parallelism**: Rust + Node backends at the same time, etc.

You can also go **serial** (simpler tracking) if you prefer: Phase 1 → Phase 2 → Phase 3 → ...

**Your preference**: Parallel (faster) or serial (simpler tracking)?

**Answer**: I think going serial is going to be faster/better so we can find out issues we have an add those to future implementation portions. 

---

## Immediate Action Items

### Right Now
1. **Answer the 4 questions above** ⬆️
2. **Confirm local LLM endpoints** (paste output of the curl commands above)
3. **Read IMPLEMENTATION_PLAN.md** for the full vision

### In the Next Hour
1. **Haiku creates Phase 0 spec** (you'll see it in this conversation)
2. **You review the spec** and give the go-ahead
3. **Spin up the first subagent** (I'll provide exact commands)

### Tomorrow
1. **Subagent works through Phase 0** (repo scaffold, OpenAPI, CI)
2. **You check in on progress** (runs during the day/background)
3. **Haiku validates** Phase 0 outputs

---

## The Harness in Action (Example Flow)

```
Day 1, Hour 1:
  Haiku: "Ready to start Phase 0? Here's the spec..."
  You: "Yes, start it."
  Haiku: "Spinning up agent-foundation. Status endpoint: http://localhost:9000/phase-0-status"

Day 1, Hour 3:
  You: "Check status"
  Haiku: "Agent is working on Task 0.1 (monorepo scaffold). ETA 30 min."

Day 1, Hour 5:
  Agent: [PASS] Task 0.1 — git commit monorepo-scaffold
  Agent: [PASS] Task 0.2 — git commit openapi-contract
  Agent: [PASS] Task 0.3 — git commit seed-data
  ... (6 commits total)
  Agent: "Phase 0 complete. Branch: phase-0-foundation. All CI passing."

Day 1, Hour 6:
  Haiku: "I've verified:
    ✓ All 6 commits present
    ✓ CI passes on every commit
    ✓ `make dev` brings everything up
    ✓ Schema is byte-for-byte identical across 6 dbs
    → Ready to merge and start Phase 1+2"

Day 2, Hour 1:
  Haiku: "Starting Phase 1 (Go backend) and Phase 2 (Infrastructure) in parallel.
    Sending Go spec to Gemma4 agent.
    Sending Terraform spec to infrastructure agent.
    Both should report back in ~24-48 hours."
```

---

## Cost Tracking (Transparency)

During **Phase 0**: ~$0 (local work only, no GCP)

During **Phase 2** (first GKE deploy):
- Cluster running 6 pods + observability: ~$3-5/day
- Cloud SQL: ~$1.20/day
- **Budget**: Stop if daily spend > $10 (Phase 2 is not yet live, just testing)

During **Phases 3-6** (the real benchmark site running):
- Expected: ~$3-5/day
- Hard cap: $150/month (Phase 2 sets this up)

You can monitor costs live via:
```bash
gcloud billing projects list
gcloud compute project-info describe PROJECT_ID --format='value(billing_enabled)'
```

---

## Failure Recovery

If a subagent fails partway through a phase:

1. **Haiku rolls back the branch** to the last passing commit
2. **Haiku tries the same task with a different model**, or
3. **You manually fix and push**, then tell Haiku to resume

Example:
```
Agent-Go fails at Task 1.4 (tax client).
  → Haiku rolls back to task-1.3-passing
  → Haiku tries again with Gemma4 (different generation)
  → If still fails: Haiku escalates to you with the error
  → You fix locally and push; Haiku resumes from Task 1.5
```

**You're never stuck.** Worst case: Haiku hands you the task spec and you implement it yourself (local LLMs are assistants, not replacements).

---

## When Things Ship (Milestones)

| Milestone | When | What You Can Do |
|---|---|---|
| Phase 0 complete | Week 1 | Show anyone the local `make dev` setup |
| Phase 1 + 2 complete | Week 3 | Live Go backend at a URL, show latency charts |
| Phase 3 complete | Week 6 | Live comparison of Go + Rust + Node, show relative performance |
| Phase 4 complete | Week 8 | **LIVE SITE** — bakeoff.ce.dev is public, fully interactive |
| Phase 5 complete | Week 9 | Stress mode, comparison mode fully featured |
| Phase 6 complete | Week 10 | **SHIPPED** — on your portfolio, linked from socials, ready to share |
| Phase 7 complete | Week 13 | v1 with all 6 backends (optional, but impressive) |

**Marketing timeline:**
- Week 8 (Phase 4 done): Share a screenshot of the live site with Go + Rust + Node
- Week 10 (Phase 6 done): Full launch (link from portfolio, HN, Twitter, etc.)
- Week 13 (Phase 7 done): "Updated with Bun, Python, PHP backends" post

---

## What to Tell Your Network

**The elevator pitch** (for recruiter, fellow engineer, Twitter):

> I built an interactive benchmark comparing six backend runtimes (Go, Rust, Bun, Node, Python, PHP) running the same e-commerce checkout endpoint side-by-side on Kubernetes. You can pick a runtime, place an order, and watch real latency and throughput metrics update. It demonstrates how I think about fairness in comparisons, observability at scale, and interactive product design. [link]

**Why it matters**:
- Shows **systems thinking** (Kubernetes, observability, cost optimization)
- Shows **breadth** (6 languages, each idiomatic)
- Shows **rigor** (the methodology is the story, not the results)
- Shows **product instinct** (interactive beats static benchmarks)
- Shows **accountability** (hard cap, wake-up choreography, all costs visible)

---

## Next: You Decide

**Are you ready to start Phase 0 right now, or would you like to:**

- [ ] Ask clarifying questions about the plan?
- [ ] Adjust scope (v0 vs v1)?
- [ ] Set up prerequisites first (GCP project, local model endpoints)?
- [ ] Iterate on the plan with other ideas?

**Just reply with what you want to do, and I'll either:**
1. **Answer your questions** and refine the plan
2. **Create the detailed Phase 0 task spec** to send to the first subagent
3. **Help set up prerequisites** (GCP, models, etc.)

---

**The bar for "go"**: You have answers to the 4 key questions above, and you're ready to see the Phase 0 spec in detail. Once you say the word, I'll create it.

