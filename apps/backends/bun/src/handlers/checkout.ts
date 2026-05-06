import postgres from 'postgres';
import { Context } from 'hono';
import { CheckoutRequest } from '../types/index';
import { processCheckout } from '../services/checkout';

export async function handleCheckout(c: Context, pool: postgres.Sql, taxServiceUrl: string): Promise<Response> {
  try {
    const req: CheckoutRequest = await c.req.json();
    const result = await processCheckout(req, pool, taxServiceUrl);
    return c.json(result, 201);
  } catch (error: any) {
    const msg = error.message || 'Unknown error';
    if (msg.includes('Invalid')) {
      return c.json({ error: msg }, 400);
    } else if (msg.includes('stock') || msg.includes('Cart must')) {
      return c.json({ error: msg }, 422);
    } else {
      return c.json({ error: msg }, 500);
    }
  }
}
