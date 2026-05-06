import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getProduct, insertOrder } from '../db/queries.js';
import { computeFraudScore } from './fraud.js';
import { calculateTax } from '../clients/tax.js';
import { CheckoutRequest, CheckoutResponse, OrderItem } from '../types.js';

export async function processCheckout(
  req: CheckoutRequest,
  pool: Pool,
  taxServiceUrl: string
): Promise<CheckoutResponse> {
  if (!req.items || req.items.length === 0 || req.items.length > 8) {
    throw new Error('Cart must have 1-8 items');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(req.customer_id)) {
    throw new Error('Invalid customer ID');
  }

  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  for (const item of req.items) {
    if (!uuidRegex.test(item.product_id)) {
      throw new Error('Invalid product ID');
    }

    const product = await getProduct(pool, item.product_id);
    if (product.stock < item.quantity) {
      throw new Error('Insufficient stock');
    }

    subtotal += product.price_cents * item.quantity;
    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      price_cents: product.price_cents,
    });
  }

  const taxResp = await calculateTax(taxServiceUrl, subtotal, req.state);
  const fraudScore = computeFraudScore(subtotal, orderItems.length);
  const orderId = uuidv4();
  const total = subtotal + taxResp.tax_cents;

  await insertOrder(pool, { 
    id: orderId, 
    customer_id: req.customer_id, 
    total_cents: total, 
    tax_cents: taxResp.tax_cents 
  }, orderItems);

  return {
    order_id: orderId,
    total_cents: total,
    tax_cents: taxResp.tax_cents,
    fraud_score: fraudScore,
  };
}
