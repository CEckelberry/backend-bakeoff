#!/bin/bash
# Phase 0 Agent (Bash version - no Python dependencies)
# Feeds PHASE_0_SPEC.md to llama-swap API and saves the implementation plan

set -e

PROJECT_DIR="/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff"
SPEC_FILE="$PROJECT_DIR/PHASE_0_SPEC.md"
OUTPUT_DIR="$PROJECT_DIR/.phase-0-output"
API_ENDPOINT="http://localhost:8080/v1"
MODEL="lisaria-architect"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🚀 PHASE 0 AGENT: Automated LLM Implementation (Bash)"
echo "════════════════════════════════════════════════════════════════════════════════"

# Check API is reachable
echo ""
echo "📡 Checking llama-swap API..."
if ! curl -s "$API_ENDPOINT/models" | grep -q "lisaria-architect"; then
    echo "❌ Cannot reach API or model not found"
    echo "   Make sure llama-swap is running on localhost:8080"
    exit 1
fi
echo "✅ API healthy. Model '$MODEL' available."

# Read spec
echo ""
echo "📄 Reading specification..."
if [ ! -f "$SPEC_FILE" ]; then
    echo "❌ Spec file not found: $SPEC_FILE"
    exit 1
fi
SPEC=$(cat "$SPEC_FILE")
SPEC_SIZE=$(wc -c < "$SPEC_FILE")
echo "✅ Spec loaded ($SPEC_SIZE bytes)"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Prepare the prompt
SYSTEM_PROMPT="You are an expert software engineer implementing Backend Bake-off Phase 0.

Read the specification carefully. Implement all 6 subtasks exactly as specified.

Follow every constraint. Validate against acceptance criteria.

Output exact file paths and complete file content for every file you create.

For each subtask:
1. Explain what you're doing
2. Provide exact file paths and content
3. Provide exact commands to run
4. Explain how to verify it works
5. Provide the git commit message

Never skip steps. Never assume. Always be explicit.

Output everything in markdown format with clear headers for each subtask."

# Send to API
echo ""
echo "🚀 Sending specification to $MODEL..."
echo "   API: $API_ENDPOINT/chat/completions"
echo "   Temperature: 0.3 (deterministic)"
echo "   Max tokens: 32000"
echo ""
echo "⏱️  Waiting for response (this may take a few minutes)..."
echo ""

# Escape strings for JSON
escape_json() {
    python3 -c "import json; import sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null || \
    sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g' | tr -d '\r'
}

SPEC_ESCAPED=$(echo "$SPEC" | escape_json)
SYSTEM_ESCAPED=$(echo "$SYSTEM_PROMPT" | escape_json)

# Build JSON payload
PAYLOAD=$(cat <<EOF
{
  "model": "$MODEL",
  "messages": [
    {
      "role": "system",
      "content": $SYSTEM_ESCAPED
    },
    {
      "role": "user",
      "content": "Here is the Phase 0 specification. Implement all 6 subtasks exactly:\n\n$SPEC_ESCAPED"
    }
  ],
  "temperature": 0.3,
  "top_p": 0.95,
  "max_tokens": 32000,
  "stream": false
}
EOF
)

# Send request
RESPONSE=$(curl -s -X POST "$API_ENDPOINT/chat/completions" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "❌ API returned error:"
    echo "$RESPONSE" | jq '.error' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Save raw response
echo "$RESPONSE" > "$OUTPUT_DIR/response.json"
echo ""
echo "💾 Raw response saved: $OUTPUT_DIR/response.json"

# Extract content using jq or fallback
if command -v jq &> /dev/null; then
    CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content')
else
    # Fallback: basic extraction with sed/grep
    CONTENT=$(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$CONTENT" ]; then
    echo "❌ Could not extract content from response"
    echo "Response:"
    echo "$RESPONSE" | head -50
    exit 1
fi

# Save markdown plan
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MD_FILE="$OUTPUT_DIR/phase-0-plan.md"

cat > "$MD_FILE" << EOF
# Phase 0 Implementation Plan

**Generated:** $TIMESTAMP  
**Model:** $MODEL  
**Status:** Ready to implement

---

$CONTENT

---

## Next Steps

1. Read through this plan carefully
2. For each subtask:
   - Create the files exactly as specified
   - Run the commands exactly as shown
   - Verify with the provided checks
   - Commit to git with the provided message
3. After all 6 subtasks, run: \`make dev && bash scripts/audit-methodology.sh\`
4. Message Haiku when Phase 0 is complete

EOF

echo "📝 Implementation plan saved: $MD_FILE"

# Display content (first 150 lines)
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "📋 PHASE 0 IMPLEMENTATION PLAN"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "$CONTENT" | head -150
echo ""
TOTAL_LINES=$(echo "$CONTENT" | wc -l)
SHOWN_LINES=150
if [ "$TOTAL_LINES" -gt "$SHOWN_LINES" ]; then
    echo "... ($(($TOTAL_LINES - $SHOWN_LINES)) more lines) ..."
fi
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"

# Final instructions
echo ""
echo "✅ PHASE 0 PLAN GENERATED"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📂 Output directory: $OUTPUT_DIR"
echo ""
echo "Files created:"
echo "  • response.json        - Raw API response"
echo "  • phase-0-plan.md      - Implementation instructions (READ THIS)"
echo ""
echo "Next steps:"
echo "  1. Open: $MD_FILE"
echo "  2. Follow the instructions for each subtask"
echo "  3. Create files, run commands, commit to git"
echo "  4. When all 6 subtasks are done, run:"
echo "     - make dev"
echo "     - bash scripts/audit-methodology.sh"
echo "  5. Message Haiku: 'Phase 0 complete'"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
