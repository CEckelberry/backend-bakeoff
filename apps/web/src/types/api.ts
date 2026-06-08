export type Runtime = 'go' | 'rust' | 'bun' | 'node' | 'python' | 'php';

export interface TimingBreakdown {
  dns: number;
  tcp: number;
  tls: number;
  processing: number;
}

export interface OrderResponse {
  order_id: string;
  status: 'success' | 'error';
  total: number;
  tax: number;
  shipping: number;
  timing_breakdown?: TimingBreakdown;
}

export interface CheckoutRequest {
  user_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}
