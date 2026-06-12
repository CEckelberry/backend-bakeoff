import httpx
from typing import Optional
from app.models.types import TaxResponse

_client: Optional[httpx.AsyncClient] = None


async def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(timeout=5.0)


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def calculate_tax(
    tax_service_url: str,
    subtotal_cents: int,
    state: str,
) -> TaxResponse:
    if _client is None:
        raise RuntimeError("HTTP client not initialized")
    response = await _client.post(
        f'{tax_service_url}/tax',
        json={'subtotal_cents': subtotal_cents, 'state': state},
    )
    response.raise_for_status()
    data = response.json()
    return TaxResponse(**data)
