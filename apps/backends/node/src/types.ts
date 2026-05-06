export interface Product {
  id: string;
  price_cents: number;
  stock: number;
}

export interface Order {
  id: string;
  customer_id: string;
  total_cents: number;
  tax_cents: number;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  price_cents: number;
}

export interface CheckoutRequest {
  customer_id: string;
  items: Array<{ product_id: string; quantity: number }>;
  state: string;
}

export interface CheckoutResponse {
  order_id: string;
  total_cents: number;
  tax_cents: number;
  fraud_score: number;
}
