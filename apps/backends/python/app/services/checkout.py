import asyncpg
import uuid as uuid_module
from app.models.types import CheckoutRequest, CheckoutResponse, OrderItem
from app.db.queries import get_product, insert_order
from app.services.fraud import compute_fraud_score
from app.clients.tax import calculate_tax

async def process_checkout(
    req: CheckoutRequest,
    pool: asyncpg.Pool,
    tax_service_url: str,
) -> CheckoutResponse:
    if not req.items or len(req.items) == 0 or len(req.items) > 8:
        raise ValueError('Cart must have 1-8 items')

    # Validate customer ID (UUID format)
    try:
        customer_uuid = uuid_module.UUID(req.customer_id)
    except (ValueError, TypeError):
        raise ValueError('Invalid customer ID')

    subtotal = 0
    order_items = []

    for item in req.items:
        try:
            product_id = uuid_module.UUID(item.product_id)
        except (ValueError, TypeError):
            raise ValueError('Invalid product ID')

        product = await get_product(pool, item.product_id)
        if product['stock'] < item.quantity:
            raise ValueError('Insufficient stock')

        subtotal += product['price_cents'] * item.quantity
        order_items.append(OrderItem(
            product_id=item.product_id,
            quantity=item.quantity,
            price_cents=product['price_cents'],
        ))

    tax_resp = await calculate_tax(tax_service_url, subtotal, req.state)
    fraud_score = compute_fraud_score(subtotal, len(order_items))
    order_id = str(uuid_module.uuid4())
    total = subtotal + tax_resp.tax_cents

    await insert_order(
        pool,
        order_id,
        req.customer_id,
        total,
        tax_resp.tax_cents,
        [dict(
            product_id=item.product_id,
            quantity=item.quantity,
            price_cents=item.price_cents,
        ) for item in order_items],
    )

    return CheckoutResponse(
        order_id=order_id,
        total_cents=total,
        tax_cents=tax_resp.tax_cents,
        fraud_score=fraud_score,
    )
