import asyncpg
import uuid as uuid_module
from typing import List

async def get_product(pool: asyncpg.Pool, product_id: str) -> dict:
    row = await pool.fetchrow(
        'SELECT id, price_cents, stock FROM bakeoff_python.products WHERE id = $1',
        uuid_module.UUID(product_id)
    )
    if row is None:
        raise ValueError('Product not found')
    return dict(row)

async def insert_order(
    pool: asyncpg.Pool,
    order_id: str,
    customer_id: str,
    total_cents: int,
    tax_cents: int,
    items: List[dict],
) -> None:
    async with pool.acquire(timeout=5.0) as conn:
        async with conn.transaction():
            # Insert order
            await conn.execute(
                'INSERT INTO bakeoff_python.orders (id, customer_id, total_cents, tax_cents, created_at) VALUES ($1, $2, $3, $4, NOW())',
                uuid_module.UUID(order_id),
                uuid_module.UUID(customer_id),
                total_cents,
                tax_cents,
            )

            # Insert items and update stock
            for item in items:
                await conn.execute(
                    'INSERT INTO bakeoff_python.order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
                    uuid_module.uuid4(),
                    uuid_module.UUID(order_id),
                    uuid_module.UUID(item['product_id']),
                    item['quantity'],
                    item['price_cents'],
                )

                result = await conn.execute(
                    'UPDATE bakeoff_python.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
                    item['quantity'],
                    uuid_module.UUID(item['product_id']),
                )

                if result == 'UPDATE 0':
                    raise ValueError('Insufficient stock')
