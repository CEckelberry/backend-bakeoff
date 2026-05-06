#!/usr/bin/env python3
"""
Phase 0 Agent: Automated execution via llama-swap API
Uses only standard library (no external dependencies)
"""

import json
import sys
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path("/home/roger/Documents/coding/cole-portfolio-apps/backend-bakeoff")
SPEC_FILE = PROJECT_ROOT / "PHASE_0_SPEC.md"
OUTPUT_DIR = PROJECT_ROOT / ".phase-0-output"
API_ENDPOINT = "http://localhost:8080/v1/chat/completions"
MODEL = "lisaria-architect"

def check_api():
    try:
        with urllib.request.urlopen("http://localhost:8080/v1/models", timeout=5) as response:
            data = json.loads(response.read().decode())
            models = data.get('data', [])
            model_names = [m['id'] for m in models]
            
            if MODEL not in model_names:
                print(f"❌ Model '{MODEL}' not found. Available: {model_names}")
                sys.exit(1)
            
            print(f"✅ API healthy. Model '{MODEL}' available.")
            return True
    except Exception as e:
        print(f"❌ Cannot reach llama-swap API")
        print(f"   Error: {e}")
        sys.exit(1)

def main():
    print("\n" + "="*80)
    print("🚀 PHASE 0 AGENT: Automated LLM Implementation")
    print("="*80 + "\n")
    
    # Check API
    print("📡 Checking llama-swap API...")
    check_api()
    
    # Read spec
    print("\n📄 Reading specification...")
    if not SPEC_FILE.exists():
        print(f"❌ Spec file not found: {SPEC_FILE}")
        sys.exit(1)
    
    with open(SPEC_FILE, 'r') as f:
        spec = f.read()
    print(f"✅ Spec loaded ({len(spec)} bytes)")
    
    # Create output dir
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Prepare request
    print(f"\n🚀 Sending to {MODEL}...")
    print(f"   API: {API_ENDPOINT}")
    print(f"   Temperature: 0.3 | Max tokens: 32000")
    print(f"\n⏱️  Waiting for response (this may take 2-5 minutes)...\n")
    
    system_prompt = """You are an expert software engineer implementing Backend Bake-off Phase 0.

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

Output everything in markdown format with clear headers for each subtask."""

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": f"Implement Phase 0 based on this specification:\n\n{spec}"
            }
        ],
        "temperature": 0.3,
        "top_p": 0.95,
        "max_tokens": 32000,
        "stream": False
    }
    
    try:
        request = urllib.request.Request(
            API_ENDPOINT,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(request, timeout=600) as response:
            response_json = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ API error: {e}")
        sys.exit(1)
    
    # Save raw response
    with open(OUTPUT_DIR / "response.json", 'w') as f:
        json.dump(response_json, f, indent=2)
    
    # Extract content
    try:
        content = response_json['choices'][0]['message']['content']
    except (KeyError, IndexError):
        print("❌ Unexpected response format")
        print(json.dumps(response_json, indent=2))
        sys.exit(1)
    
    # Save markdown
    timestamp = datetime.now().isoformat()
    md_file = OUTPUT_DIR / "phase-0-plan.md"
    
    with open(md_file, 'w') as f:
        f.write(f"""# Phase 0 Implementation Plan

**Generated:** {timestamp}
**Model:** {MODEL}
**Status:** Ready to implement

---

{content}

---

## Next Steps

1. Read through this plan carefully
2. For each subtask:
   - Create the files exactly as specified
   - Run the commands exactly as shown
   - Verify with the provided checks
   - Commit to git with the provided message
3. After all 6 subtasks, run: `make dev && bash scripts/audit-methodology.sh`
4. Push to GitHub

""")
    
    # Display
    print("="*80)
    print("📋 PHASE 0 IMPLEMENTATION PLAN")
    print("="*80 + "\n")
    
    lines = content.split('\n')
    display_lines = lines[:200]
    print('\n'.join(display_lines))
    
    if len(lines) > 200:
        print(f"\n... ({len(lines) - 200} more lines) ...")
    
    print("\n" + "="*80)
    print("✅ PHASE 0 PLAN GENERATED")
    print("="*80)
    print(f"""
📂 Files saved:
  • {OUTPUT_DIR}/response.json
  • {OUTPUT_DIR}/phase-0-plan.md ← READ THIS

Next: Open phase-0-plan.md and follow the implementation instructions.

""")

if __name__ == "__main__":
    main()
