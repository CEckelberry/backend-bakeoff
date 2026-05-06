export interface Product {
  id: string;
  price_cents: number;
  stock: number;
}

export interface CheckoutItem {
  product_id: string;
  quantity: number;
}

export interface CheckoutRequest {
  customer_id: string;
  items: CheckoutItem[];
  state: string;
}

export interface CheckoutResponse {
  order_id: string;
  total_cents: number;
  tax_cents: number;
  fraud_score: number;
}

export interface TaxRequest {
  subtotal_cents: number;
  state: string;
}

export interface TaxResponse {
  tax_cents: number;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  price_cents: number;
}
