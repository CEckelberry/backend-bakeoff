from pydantic import BaseModel
from typing import List
from uuid import UUID

class Product(BaseModel):
    id: UUID
    price_cents: int
    stock: int

class CheckoutItem(BaseModel):
    product_id: str
    quantity: int

class CheckoutRequest(BaseModel):
    customer_id: str
    items: List[CheckoutItem]
    state: str

class CheckoutResponse(BaseModel):
    order_id: str
    total_cents: int
    tax_cents: int
    fraud_score: int

class TaxRequest(BaseModel):
    subtotal_cents: int
    state: str

class TaxResponse(BaseModel):
    tax_cents: int

class OrderItem(BaseModel):
    product_id: str
    quantity: int
    price_cents: int
