import asyncpg
from fastapi import HTTPException


async def products(pool: asyncpg.Pool) -> dict:
    rows = await pool.fetch(
        "SELECT id, sku, name, price_cents, stock FROM products ORDER BY name"
    )
    return {
        "products": [
            {
                "id": str(r["id"]),
                "sku": r["sku"],
                "name": r["name"],
                "price_cents": r["price_cents"],
                "stock": r["stock"],
            }
            for r in rows
        ]
    }


async def product_by_id(product_id: str, pool: asyncpg.Pool) -> dict:
    row = await pool.fetchrow(
        "SELECT id, sku, name, price_cents, stock FROM products WHERE id = $1",
        product_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    return {
        "id": str(row["id"]),
        "sku": row["sku"],
        "name": row["name"],
        "price_cents": row["price_cents"],
        "stock": row["stock"],
    }
