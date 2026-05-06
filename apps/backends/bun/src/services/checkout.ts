import postgres from 'postgres';
import { CheckoutRequest, CheckoutResponse, OrderItem } from '../types/index';
import { getProduct, insertOrder } from '../db/queries';
import { computeFraudScore } from './fraud';
import { calculateTax } from '../clients/tax';

export async function processCheckout(
  req: CheckoutRequest,
  pool: postgres.Sql,
  taxServiceUrl: string,
): Promise<CheckoutResponse> {
  if (!req.items || req.items.length === 0 || req.items.length > 8) {
    throw new Error('Cart must have 1-8 items');
  }

  if (!isValidUUID(req.customer_id)) {
    throw new Error('Invalid customer ID');
  }

  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  for (const item of req.items) {
    if (!isValidUUID(item.product_id)) {
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
  const orderId = crypto.randomUUID();
  const total = subtotal + taxResp.tax_cents;

  await insertOrder(pool, orderId, req.customer_id, total, taxResp.tax_cents, orderItems);

  return {
    order_id: orderId,
    total_cents: total,
    tax_cents: taxResp.tax_cents,
    fraud_score: fraudScore,
  };
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
