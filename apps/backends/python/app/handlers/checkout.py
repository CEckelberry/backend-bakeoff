from fastapi import HTTPException
import asyncpg
from app.models.types import CheckoutRequest, CheckoutResponse
from app.services.checkout import process_checkout

async def checkout(
    req: CheckoutRequest,
    pool: asyncpg.Pool,
    tax_service_url: str,
) -> CheckoutResponse:
    try:
        return await process_checkout(req, pool, tax_service_url)
    except ValueError as e:
        msg = str(e)
        if 'Invalid' in msg:
            raise HTTPException(status_code=400, detail=msg)
        elif 'stock' in msg or 'Cart must' in msg:
            raise HTTPException(status_code=422, detail=msg)
        else:
            raise HTTPException(status_code=500, detail=msg)
