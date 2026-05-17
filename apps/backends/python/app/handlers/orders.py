import asyncpg
from fastapi import HTTPException


async def recent_orders(pool: asyncpg.Pool) -> dict:
    rows = await pool.fetch(
        "SELECT id, customer_id, total_cents, tax_cents, created_at "
        "FROM orders ORDER BY created_at DESC LIMIT 20"
    )
    return {
        "orders": [
            {
                "id": str(r["id"]),
                "customer_id": str(r["customer_id"]),
                "total_cents": r["total_cents"],
                "tax_cents": r["tax_cents"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }


async def order_by_id(order_id: str, pool: asyncpg.Pool) -> dict:
    row = await pool.fetchrow(
        "SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders WHERE id = $1",
        order_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="not found")
    item_rows = await pool.fetch(
        "SELECT product_id, quantity, price_cents FROM order_items WHERE order_id = $1",
        order_id,
    )
    return {
        "id": str(row["id"]),
        "customer_id": str(row["customer_id"]),
        "total_cents": row["total_cents"],
        "tax_cents": row["tax_cents"],
        "created_at": row["created_at"].isoformat(),
        "items": [
            {
                "product_id": str(ir["product_id"]),
                "quantity": ir["quantity"],
                "price_cents": ir["price_cents"],
            }
            for ir in item_rows
        ],
    }


async def revenue_report(pool: asyncpg.Pool) -> dict:
    rows = await pool.fetch(
        "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents "
        "FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' "
        "GROUP BY DATE(created_at) ORDER BY date DESC"
    )
    return {
        "report": [
            {
                "date": str(r["date"]),
                "order_count": r["order_count"],
                "revenue_cents": r["revenue_cents"],
            }
            for r in rows
        ]
    }
