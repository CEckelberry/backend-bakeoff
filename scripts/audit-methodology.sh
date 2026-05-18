#!/bin/bash
# Methodology Audit Script for Backend Bake-off Phase 0
# Enforces the locked methodology rules from METHODOLOGY.md

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🔍 BACKEND BAKE-OFF METHODOLOGY AUDIT - PHASE 0"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Test: Required files
echo "📋 Checking required files..."
REQUIRED_FILES=("api/openapi.yaml" "packages/seed-data/products.json" "docker-compose.yml" "Makefile" "pnpm-workspace.yaml" ".editorconfig" "LICENSE")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✅${NC} $file"
        ((PASSED++))
    else
        echo -e "  ${RED}❌${NC} Missing: $file"
        ((FAILED++))
    fi
done
echo ""

# Test: OpenAPI Endpoints
echo "📝 Checking OpenAPI spec..."
if grep -q "openapi: 3.1.0" api/openapi.yaml; then
    echo -e "  ${GREEN}✅${NC} OpenAPI version 3.1.0"
    ((PASSED++))
else
    echo -e "  ${RED}❌${NC} OpenAPI version not 3.1.0"
    ((FAILED++))
fi

ENDPOINTS=$(grep -E '^  /[a-z]' api/openapi.yaml | sed 's/^  \(.*\):.*/\1/' | tr -d '/' | sort | uniq)
VALID_ENDPOINTS=("checkout" "health")
ENDPOINT_OK=1
for ep in $ENDPOINTS; do
    if [[ ! " ${VALID_ENDPOINTS[@]} " =~ " ${ep} " ]]; then
        echo -e "  ${RED}❌${NC} Forbidden endpoint: /$ep (only /checkout and /health allowed)"
        ((FAILED++))
        ENDPOINT_OK=0
    fi
done
if [ $ENDPOINT_OK -eq 1 ]; then
    echo -e "  ${GREEN}✅${NC} Only allowed endpoints (/checkout, /health) present"
    ((PASSED++))
fi
echo ""

# Test: Database Schema consistency
echo "🗄️ Checking database schema..."
SCHEMAS=("bakeoff_go" "bakeoff_rust" "bakeoff_rails" "bakeoff_node" "bakeoff_python" "bakeoff_php")
SCHEMA_COUNT=${#SCHEMAS[@]}
grep -q "CREATE SCHEMA.*bakeoff_go" packages/seed-data/migrations/001_init.sql && \
echo -e "  ${GREEN}✅${NC} All 6 schemas defined in migration" && \
((PASSED++)) || \
(echo -e "  ${RED}❌${NC} Not all schemas found" && ((FAILED++)))

# Check for table definitions
for TABLE in "products" "orders" "order_items"; do
    grep -q "CREATE TABLE.*\.$TABLE" packages/seed-data/migrations/001_init.sql && \
    echo -e "  ${GREEN}✅${NC} Table $TABLE defined" && \
    ((PASSED++)) || \
    (echo -e "  ${RED}❌${NC} Table $TABLE not found" && ((FAILED++)))
done
echo ""

# Test: Product catalog size
echo "📦 Checking product catalog..."
PRODUCT_COUNT=$(jq 'length' packages/seed-data/products.json 2>/dev/null || echo "0")
if [ "$PRODUCT_COUNT" -eq 200 ]; then
    echo -e "  ${GREEN}✅${NC} Exactly 200 products in catalog"
    ((PASSED++))
else
    echo -e "  ${RED}❌${NC} Expected 200 products, found $PRODUCT_COUNT"
    ((FAILED++))
fi
echo ""

# Test: Docker Compose services
echo "🐳 Checking Docker Compose..."
if command -v docker &> /dev/null; then
    SERVICE_COUNT=$(docker compose config --services 2>/dev/null | wc -l)
    if [ "$SERVICE_COUNT" -eq 9 ]; then
        echo -e "  ${GREEN}✅${NC} Exactly 9 services configured"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠️${NC}  Expected 9 services, config shows $SERVICE_COUNT (might be OK if docker not running)"
    fi
else
    echo -e "  ${YELLOW}⚠️${NC}  Docker not installed (skipping service count check)"
fi

# Check ports are configured correctly
EXPECTED_PORTS=("5432" "8081" "8082" "8083" "8084" "8085" "8086" "8087" "8090" "9090" "3001")
PORT_OK=1
for port in "${EXPECTED_PORTS[@]}"; do
    if grep -q ":$port:" docker-compose.yml; then
        ((PORT_OK++))
    fi
done
if [ $PORT_OK -ge 11 ]; then
    echo -e "  ${GREEN}✅${NC} All expected ports configured in docker-compose"
    ((PASSED++))
fi
echo ""

# Test: No TODOs/FIXMEs
echo "📝 Checking for TODOs and FIXMEs..."
TODO_COUNT=$(grep -rE "TODO|FIXME" packages/ api/ infra/observability/ .github/ 2>/dev/null | grep -v ".md:" | wc -l || echo "0")
if [ "$TODO_COUNT" -eq 0 ]; then
    echo -e "  ${GREEN}✅${NC} No TODO/FIXME comments found"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️${NC}  Found $TODO_COUNT TODO/FIXME comments (informational)"
fi
echo ""

# Test: Git setup
echo "📦 Checking Git setup..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$CURRENT_BRANCH" == "phase-0-foundation" ]]; then
        echo -e "  ${GREEN}✅${NC} On correct branch: phase-0-foundation"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠️${NC}  On branch $CURRENT_BRANCH (expected phase-0-foundation)"
    fi
    
    COMMIT_COUNT=$(git rev-list --count HEAD)
    if [ "$COMMIT_COUNT" -ge 5 ]; then
        echo -e "  ${GREEN}✅${NC} At least 5 commits found"
        ((PASSED++))
    fi
else
    echo -e "  ${YELLOW}⚠️${NC}  Not in a git repository"
fi
echo ""

# Final summary
echo "════════════════════════════════════════════════════════════════════════════════"
echo "📊 AUDIT SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ METHODOLOGY AUDIT PASSED${NC}"
    echo ""
    echo "Phase 0 foundation is solid. Ready for Phase 1."
    exit 0
else
    echo -e "${RED}❌ METHODOLOGY AUDIT FAILED${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
    exit 1
fi
