import postgres from 'postgres';
import { Product, OrderItem } from '../types/index';

export async function getProduct(pool: postgres.Sql, productId: string): Promise<Product> {
  const rows = await pool<Product[]>`
    SELECT id, price_cents, stock FROM bakeoff_bun.products WHERE id = ${productId}
  `;

  if (rows.length === 0) {
    throw new Error('Product not found');
  }

  return rows[0];
}

export async function insertOrder(
  pool: postgres.Sql,
  orderId: string,
  customerId: string,
  totalCents: number,
  taxCents: number,
  items: OrderItem[],
): Promise<void> {
  await pool.begin(async (trx) => {
    // Insert order
    await trx`
      INSERT INTO bakeoff_bun.orders (id, customer_id, total_cents, tax_cents, created_at)
      VALUES (${orderId}, ${customerId}, ${totalCents}, ${taxCents}, NOW())
    `;

    // Insert items and update stock
    for (const item of items) {
      await trx`
        INSERT INTO bakeoff_bun.order_items (id, order_id, product_id, quantity, price_cents, created_at)
        VALUES (${crypto.randomUUID()}, ${orderId}, ${item.product_id}, ${item.quantity}, ${item.price_cents}, NOW())
      `;

      const result = await trx`
        UPDATE bakeoff_bun.products
        SET stock = stock - ${item.quantity}
        WHERE id = ${item.product_id} AND stock >= ${item.quantity}
      `;

      if (result.count === 0) {
        throw new Error('Insufficient stock');
      }
    }
  });
}
