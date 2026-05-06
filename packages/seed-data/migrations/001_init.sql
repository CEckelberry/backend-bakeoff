-- Create schemas for each runtime
CREATE SCHEMA IF NOT EXISTS bakeoff_go;
CREATE SCHEMA IF NOT EXISTS bakeoff_rust;
CREATE SCHEMA IF NOT EXISTS bakeoff_bun;
CREATE SCHEMA IF NOT EXISTS bakeoff_node;
CREATE SCHEMA IF NOT EXISTS bakeoff_python;
CREATE SCHEMA IF NOT EXISTS bakeoff_php;

-- Create identical tables in each schema
DO $$ 
DECLARE 
    schema_name TEXT;
    schemas TEXT[] := ARRAY['bakeoff_go', 'bakeoff_rust', 'bakeoff_bun', 'bakeoff_node', 'bakeoff_python', 'bakeoff_php'];
BEGIN 
    FOREACH schema_name IN ARRAY schemas LOOP
        -- Create products table
        EXECUTE format('
            CREATE TABLE %I.products (
                id UUID PRIMARY KEY,
                sku TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
                stock INTEGER NOT NULL CHECK (stock >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ', schema_name);

        -- Create orders table
        EXECUTE format('
            CREATE TABLE %I.orders (
                id UUID PRIMARY KEY,
                customer_id UUID NOT NULL,
                total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
                tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ', schema_name);

        -- Create order_items table with foreign keys
        EXECUTE format('
            CREATE TABLE %I.order_items (
                id UUID PRIMARY KEY,
                order_id UUID NOT NULL REFERENCES %I.orders(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES %I.products(id),
                quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 8),
                price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ', schema_name, schema_name, schema_name);

        -- Create indexes for performance
        EXECUTE format('CREATE INDEX idx_%I_orders_created_at ON %I.orders(created_at)', schema_name, schema_name);
        EXECUTE format('CREATE INDEX idx_%I_order_items_order_id ON %I.order_items(order_id)', schema_name, schema_name);
        EXECUTE format('CREATE INDEX idx_%I_products_id ON %I.products(id)', schema_name, schema_name);
    END LOOP;
END $$;
