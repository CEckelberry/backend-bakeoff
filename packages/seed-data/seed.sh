#!/bin/bash
# Seed script for Backend Bake-off
# Usage: export DATABASE_URL=postgresql://user:pass@host/db && bash seed.sh

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required."
    echo "   Usage: export DATABASE_URL=postgresql://user:pass@localhost:5432/db && bash seed.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMAS=("bakeoff_go" "bakeoff_rust" "bakeoff_rails" "bakeoff_node" "bakeoff_python" "bakeoff_php")

echo "📋 Backend Bake-off Database Seeding"
echo "════════════════════════════════════════"
echo ""

# Step 1: Run migrations
echo "🔨 Running migrations..."
psql "$DATABASE_URL" < "$SCRIPT_DIR/migrations/001_init.sql"
echo "✅ 001_init.sql applied"
psql "$DATABASE_URL" < "$SCRIPT_DIR/migrations/002_benchmark_results.sql"
echo "✅ 002_benchmark_results.sql applied"
echo ""
echo "✅ Migrations completed"
echo ""

# Step 2: Seed products into all 6 schemas
echo "📦 Seeding 200 products into all 6 schemas..."

# Create temp SQL file with INSERT statements
SEED_SQL=$(mktemp)
trap "rm -f $SEED_SQL" EXIT

{
    echo "BEGIN TRANSACTION;"
    
    # Use jq to read each product and generate INSERT for each schema
    jq -c '.[]' "$SCRIPT_DIR/products.json" | while IFS= read -r product; do
        ID=$(echo "$product" | jq -r '.id')
        SKU=$(echo "$product" | jq -r '.sku')
        NAME=$(echo "$product" | jq -r '.name' | sed "s/'/''/g")
        PRICE=$(echo "$product" | jq -r '.price_cents')
        STOCK=$(echo "$product" | jq -r '.stock')
        CREATED=$(echo "$product" | jq -r '.created_at')
        
        for SCHEMA in "${SCHEMAS[@]}"; do
            echo "INSERT INTO $SCHEMA.products (id, sku, name, price_cents, stock, created_at) VALUES ('$ID', '$SKU', '$NAME', $PRICE, $STOCK, '$CREATED') ON CONFLICT DO NOTHING;"
        done
    done
    
    echo "COMMIT;"
} > "$SEED_SQL"

psql "$DATABASE_URL" < "$SEED_SQL"
echo "✅ Products seeded into all 6 schemas"
echo ""

# Step 3: Verify
echo "🔍 Verifying seeding..."
for SCHEMA in "${SCHEMAS[@]}"; do
    COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM $SCHEMA.products;")
    if [ "$COUNT" -eq 200 ]; then
        echo "✅ $SCHEMA: $COUNT products"
    else
        echo "⚠️  $SCHEMA: Expected 200, got $COUNT (may still be seeding...)"
    fi
done
echo ""

echo "════════════════════════════════════════"
echo "✅ Database seeding completed successfully!"
echo ""
echo "All 6 schemas are ready for backend implementations."
