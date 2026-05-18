# Seed Data and Schema

This package manages the database initialization for all 6 backend runtimes in the Backend Bake-off project.

## Strategy

To ensure fairness in performance benchmarking, we use:
- **Single Postgres instance** (shared hardware, identical I/O characteristics)
- **6 isolated schemas** (`bakeoff_go`, `bakeoff_rust`, etc.) - one per runtime
- **Byte-for-byte identical DDL** across all schemas
- **Separate data** to prevent contention between runtimes

This isolation + consistency pattern preserves the fairness of the methodology while preventing one slow runtime's operations from blocking another.

## Files

- **products.json** — Canonical product catalog (200 realistic products)
- **migrations/001_init.sql** — Creates all 6 schemas with identical table structures
- **seed.sh** — Script that runs migrations and seeds products into all schemas

## How to Seed

### Prerequisites

You need:
- `psql` (PostgreSQL client)
- `jq` (JSON processor)
- A running Postgres instance

### Usage

```bash
# Set your database URL
export DATABASE_URL=postgresql://user:password@localhost:5432/bakeoff

# Run the seed script
bash packages/seed-data/seed.sh
```

### What Gets Created

The script creates 6 schemas, each with 3 tables:

```
bakeoff_go/
  products      (200 rows, id, sku, name, price_cents, stock)
  orders        (0 rows initially)
  order_items   (0 rows initially)

bakeoff_rust/
  (identical structure)

bakeoff_rails/
  (identical structure)

bakeoff_node/
  (identical structure)

bakeoff_python/
  (identical structure)

bakeoff_php/
  (identical structure)
```

## Verification

After seeding, verify that all schemas have 200 products:

```bash
for schema in bakeoff_go bakeoff_rust bakeoff_rails bakeoff_node bakeoff_python bakeoff_php; do
  psql "$DATABASE_URL" -t -c "SELECT count(*) FROM $schema.products"
done
```

All should return `200`.

## Database Layout

### products
```
id              UUID PK
sku             TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
price_cents     INTEGER NOT NULL (CHECK >= 0)
stock           INTEGER NOT NULL (CHECK >= 0)
created_at      TIMESTAMPTZ DEFAULT NOW()

Index: (id)
```

### orders
```
id              UUID PK
customer_id     UUID NOT NULL
total_cents     INTEGER NOT NULL (CHECK >= 0)
tax_cents       INTEGER NOT NULL (CHECK >= 0)
created_at      TIMESTAMPTZ DEFAULT NOW()

Index: (created_at)
```

### order_items
```
id              UUID PK
order_id        UUID NOT NULL FK → orders(id) ON DELETE CASCADE
product_id      UUID NOT NULL FK → products(id)
quantity        INTEGER NOT NULL (CHECK 1 <= quantity <= 8)
price_cents     INTEGER NOT NULL (CHECK >= 0)
created_at      TIMESTAMPTZ DEFAULT NOW()

Index: (order_id)
```

## Schema Consistency

All 6 schemas have identical DDL. You can verify this:

```bash
# Dump schema structure for bakeoff_go
pg_dump -U postgres -d bakeoff --schema=bakeoff_go -s > go_schema.sql

# Dump schema structure for bakeoff_rust
pg_dump -U postgres -d bakeoff --schema=bakeoff_rust -s > rust_schema.sql

# Compare (should be identical except for schema name)
diff go_schema.sql rust_schema.sql
```

## Product Catalog

The product catalog contains 200 realistic items across various tech categories:
- Peripherals (keyboards, mice, headphones)
- Monitors and displays
- Storage devices
- Cables and adapters
- Accessories
- And more...

Prices range from $5 to $155, stock levels vary for realism.

## Notes

- Each backend application must use `SET search_path TO bakeoff_[runtime]` to access only its schema
- Connection pools should be sized identically (e.g., 20 connections per backend per the methodology)
- The seed script is idempotent - running it multiple times is safe
