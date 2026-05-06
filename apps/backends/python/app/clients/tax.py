import httpx
from app.models.types import TaxResponse

async def calculate_tax(
    tax_service_url: str,
    subtotal_cents: int,
    state: str,
) -> TaxResponse:
    async with httpx.AsyncClient(timeout=2.0) as client:
        response = await client.post(
            f'{tax_service_url}/tax',
            json={'subtotal_cents': subtotal_cents, 'state': state},
        )
        response.raise_for_status()
        data = response.json()
        return TaxResponse(**data)
