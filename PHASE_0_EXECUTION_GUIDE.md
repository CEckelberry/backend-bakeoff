# Phase 0 Execution Guide: How to Run Your Local LLM

**Status:** Ready to Execute  
**Spec Location:** `/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/PHASE_0_SPEC.md`  
**Model:** lisaria-architect (Gemma4-31B)  
**API:** http://localhost:8080/v1

---

## Quick Start: Run Phase 0 with Your Local LLM

### Option 1: Direct API Call (Recommended for Testing)

Test that the API is working and you can send prompts:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lisaria-architect",
    "messages": [
      {
        "role": "user",
        "content": "Say hello if you can see this message."
      }
    ],
    "temperature": 0.3,
    "max_tokens": 128
  }' | head -20
```

You should see a JSON response with "hello" in it. This confirms the API is working.

---

### Option 2: Create an Agent Script to Run Phase 0 Locally

I've created a script that will feed the entire Phase 0 spec to your local LLM and capture the response:

```bash
#!/bin/bash
# Run this script to execute Phase 0 with your local LLM

PROJECT_DIR="/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff"
SPEC_FILE="$PROJECT_DIR/PHASE_0_SPEC.md"
API_ENDPOINT="http://localhost:8080/v1"
MODEL="lisaria-architect"

# Read the spec
SPEC=$(cat "$SPEC_FILE")

# Send to LLM
PROMPT="You are an expert software engineer tasked with implementing a backend benchmark project. Read the specification below carefully and implement all 6 subtasks of Phase 0. Follow every constraint and acceptance criterion exactly.

SPECIFICATION:
${SPEC}

Now begin Phase 0 implementation. Start with Subtask 0.1: Monorepo Scaffold."

curl -s "$API_ENDPOINT/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are an expert software engineer implementing a complex backend project. You follow specifications exactly. You never skip steps. You validate your work against acceptance criteria.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"$PROMPT\"
      }
    ],
    \"temperature\": 0.3,
    \"top_p\": 0.95,
    \"max_tokens\": 16000
  }" | jq '.choices[0].message.content'
```

Save this as `scripts/run-phase-0-agent.sh`:

```bash
cat > scripts/run-phase-0-agent.sh << 'EOF'
#!/bin/bash
set -e

PROJECT_DIR="/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff"
SPEC_FILE="$PROJECT_DIR/PHASE_0_SPEC.md"
API_ENDPOINT="http://localhost:8080/v1"
MODEL="lisaria-architect"
OUTPUT_DIR="$PROJECT_DIR/.phase-0-output"

mkdir -p "$OUTPUT_DIR"

echo "📄 Reading Phase 0 specification..."
SPEC=$(cat "$SPEC_FILE")

echo "🚀 Sending to local LLM: $MODEL"
echo "⏱️  Waiting for response (this may take a while for local LLM)..."

RESPONSE=$(curl -s "$API_ENDPOINT/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are an expert software engineer implementing a complex backend project. You follow specifications exactly. You never skip steps. You validate your work against acceptance criteria. Output all code and commands needed.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Read this specification and implement all 6 subtasks of Phase 0 exactly. Follow every constraint. Validate against acceptance criteria.\n\nSPECIFICATION:\n\n$SPEC\"
      }
    ],
    \"temperature\": 0.3,
    \"top_p\": 0.95,
    \"max_tokens\": 32000
  }")

echo "$RESPONSE" > "$OUTPUT_DIR/response.json"

# Extract the content
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content')

echo "📝 Response saved to: $OUTPUT_DIR/response.json"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "LLM RESPONSE:"
echo "════════════════════════════════════════════════════════════"
echo "$CONTENT"
echo "════════════════════════════════════════════════════════════"

# Save to file for reference
echo "$CONTENT" > "$OUTPUT_DIR/phase-0-implementation.md"
echo ""
echo "✅ Full response saved to: $OUTPUT_DIR/phase-0-implementation.md"
EOF
chmod +x scripts/run-phase-0-agent.sh
```

Run it:
```bash
bash scripts/run-phase-0-agent.sh
```

---

### Option 3: Interactive Chat Interface (Best for Debugging)

Use the llama-swap Web UI:

```bash
# Open in browser
open http://localhost:8080/ui
# OR
firefox http://localhost:8080/ui
# OR
echo "Navigate to: http://localhost:8080/ui"
```

Then:
1. Click on "lisaria-architect" model selector
2. Paste the contents of `PHASE_0_SPEC.md` into the chat
3. Add this system prompt:
   ```
   You are an expert software engineer implementing the Backend Bake-off project Phase 0. Read the specification carefully and implement all 6 subtasks. Follow every constraint exactly. Validate against acceptance criteria before committing.
   ```
4. Send the message
5. Read the response and follow the instructions

---

## How to Actually Implement (Once You Have the LLM's Output)

The local LLM will output a plan. Your job:

1. **Read the LLM's output carefully**
2. **Execute the commands** it recommends (usually shell commands)
3. **Create the files** it specifies (it will give you exact file paths and content)
4. **Run the validation** it mentions (`make dev`, `make contract`, audit script)
5. **Commit to git** with the messages it provides

**Example flow:**

```bash
# 1. LLM says: "Create pnpm-workspace.yaml with this content:"
# You copy-paste the content into the file
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/web'
  - 'apps/router'
  # ... etc
EOF

# 2. LLM says: "Create package.json at root:"
cat > package.json << 'EOF'
{
  "name": "backend-bakeoff",
  # ... etc
}
EOF

# 3. LLM says: "Commit with git:"
git add -A
git commit -m "phase-0.1: monorepo scaffold with pnpm workspaces and Makefile"

# 4. LLM says: "Run `make dev` to verify:"
make dev

# 5. LLM says: "Check success with curl:"
curl http://localhost:8081/health
```

---

## Realistic Timeline for Local LLM Execution

Local models are slower than cloud APIs. Expect:

- **Reading spec**: ~5-10 seconds
- **First response** (Phase 0.1): ~2-5 minutes (first pass is thorough)
- **Each subsequent subtask**: ~1-3 minutes (context stays warm)
- **Total Phase 0**: ~30-60 minutes of LLM thinking (across 6 subtasks)

You don't need to wait. You can start implementing as soon as the first subtask response comes back.

---

## Monitoring & Status Checking

### Check LLM API Health

```bash
curl -s http://localhost:8080/v1/models | jq '.data[].id'
# Should output:
# lisaria-architect
# lisaria-coder
# lisaria-analyzer
# lisaria-mapper
# lisaria-planner
```

### Check Active Model Memory Usage

```bash
# Watch GPU memory (if you have `gpustat` installed)
watch -n 1 gpustat

# OR check with rocm-smi
rocm-smi
```

### Monitor Docker Compose During Phase 0.4

```bash
# In one terminal:
make dev

# In another terminal:
watch -n 2 'docker compose ps'
```

### Test Each Service as They Come Up

```bash
# Once services are up:
for port in 8081 8082 8083 8084 8085 8086 8087 8090; do
  echo "Testing port $port:"
  curl -s http://localhost:$port/health | jq '.' || echo "Not responding"
done
```

---

## Workflow: From LLM Output to Working Code

### Step 1: Receive LLM Output

Save it to a file for reference:

```bash
mkdir -p .phase-0-output
# (LLM output goes here in a markdown file)
```

### Step 2: Create a Working Branch

```bash
cd /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff
git init
git checkout -b phase-0-foundation
```

### Step 3: Follow LLM Instructions Subtask by Subtask

For each subtask (0.1, 0.2, 0.3, etc.):

1. Read what the LLM says for that subtask
2. Create all the files it mentions
3. Run the validation it recommends
4. **Commit** with the exact message it provides
5. Move to next subtask

### Step 4: Commit After Each Subtask

```bash
# After subtask 0.1:
git add -A
git commit -m "phase-0.1: monorepo scaffold with pnpm workspaces and Makefile"

# After subtask 0.2:
git add -A
git commit -m "phase-0.2: OpenAPI contract (POST /checkout, GET /health)"

# ... etc
```

### Step 5: Validate the Whole Phase

Once all 6 subtasks are committed:

```bash
# Check all commits are there
git log --oneline | head -10

# Run the whole thing
make dev

# In another terminal:
curl http://localhost:8081/health
curl http://localhost:9090/-/healthy
curl http://localhost:3001/api/health

# Run methodology audit (once Subtask 0.6 is done)
bash scripts/audit-methodology.sh

# Clean up
make dev-clean
```

---

## If the LLM Gets Stuck or Produces Bad Code

**Signs of trouble:**
- LLM repeats the same instruction multiple times
- Output is 50K+ tokens and still going (context exhaustion)
- Files it creates have obvious syntax errors
- Docker build fails

**What to do:**

1. **Stop the generation** (Ctrl+C in your terminal)
2. **Break it into smaller prompts**:
   ```bash
   # Instead of asking for all 6 subtasks at once, ask for one:
   "Implement only Subtask 0.1 (monorepo scaffold) of Phase 0. Follow the spec exactly. Output the exact file contents I should create."
   ```
3. **Provide more context**:
   ```bash
   "Here's the current state of the project: [paste git log]. Now implement Subtask 0.2 next."
   ```
4. **If code is broken**, fix it manually and commit, then ask the LLM to continue from there

---

## Full End-to-End Example

Here's exactly what to do, step by step:

```bash
# 1. Navigate to project
cd /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff

# 2. Initialize git
git init
git checkout -b phase-0-foundation

# 3. Read the spec
cat PHASE_0_SPEC.md

# 4. Open llama-swap UI
firefox http://localhost:8080/ui

# 5. (In browser) Select "lisaria-architect" model

# 6. (In browser) Paste this system prompt:
# "You are an expert engineer implementing Backend Bake-off Phase 0. 
# Read the spec, implement all 6 subtasks exactly. Follow every constraint. 
# Validate against acceptance criteria. Output exact file paths and content."

# 7. (In browser) Paste PHASE_0_SPEC.md content

# 8. (In browser) Send message and wait

# 9. (As LLM responds) Start implementing:
# - Create directories
# - Create files (copy-paste from LLM)
# - Run commands (git add, git commit, make dev)

# 10. Once Phase 0.1 is done, commit:
git add -A
git commit -m "phase-0.1: monorepo scaffold with pnpm workspaces and Makefile"

# 11. Continue with 0.2, 0.3, etc.

# 12. After all 6 subtasks:
git log --oneline | head -10
make dev
# (verify all services come up)

# 13. Done! Ready for Haiku review and Phase 1.
```

---

## Files Created This Session

Location: `/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff/`

- ✅ `PHASE_0_SPEC.md` — The full specification (22K, very detailed)
- ✅ `STRATEGY_SUMMARY.md` — High-level overview
- ✅ `QUICKSTART.md` — Prerequisites and decisions
- ✅ `IMPLEMENTATION_PLAN.md` — Full 7-phase plan
- ✅ `SESSION_RECAP.md` — What was done in planning session
- ✅ `PHASE_0_EXECUTION_GUIDE.md` — This file

Plus original docs (untouched):
- `README.md`, `METHODOLOGY.md`, `ARCHITECTURE.md`, `RUNTIMES.md`, `DESIGN.md`, `TASKS.md`

---

## Next: Start Phase 0

Ready to begin?

**Choose your method:**

### Method A: Web UI (Most Interactive)
```bash
firefox http://localhost:8080/ui
# Paste spec, add system prompt, send message
```

### Method B: Direct API (Most Automated)
```bash
bash scripts/run-phase-0-agent.sh
# Saves full output to .phase-0-output/
```

### Method C: Step-by-Step (Most Control)
```bash
# Open multiple terminals:
# Terminal 1: Follow the spec manually, implement each subtask
# Terminal 2: Run `make dev` tests
# Terminal 3: Watch `docker compose ps`
```

**Pick one and start. The local LLM will handle the heavy lifting.**

---

## Success = Phase 0 Complete

You're done when:

```bash
cd /home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff

# Check git history
git log --oneline | head -10
# Should show 6 phase-0.X commits

# Run everything
make dev

# In another terminal:
curl http://localhost:8081/health      # Go backend
curl http://localhost:9090/-/healthy   # Prometheus
curl http://localhost:3001/api/health  # Grafana

# All should return 200

# Run audit
bash scripts/audit-methodology.sh

# Should pass

# Clean up
make dev-clean

# Push branch (optional, but recommended)
git push origin phase-0-foundation
```

When all the above work, **Phase 0 is complete**. Message me (Haiku) and I'll:
1. Clone and verify locally
2. Run the whole thing
3. Review the 6 commits
4. Create Phase 1 spec (Go backend)

---

**You've got the spec. You've got the tools. Your local LLM is ready.**

**Let's build this.**

