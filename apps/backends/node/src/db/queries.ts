import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Product, Order, OrderItem } from '../types.js';

export async function getProduct(pool: Pool, productId: string): Promise<Product> {
  const result = await pool.query(
    'SELECT id, price_cents, stock FROM bakeoff_node.products WHERE id = $1',
    [productId]
  );
  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }
  return result.rows[0];
}

export async function insertOrder(
  pool: Pool,
  order: Order,
  items: OrderItem[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert order
    await client.query(
      'INSERT INTO bakeoff_node.orders (id, customer_id, total_cents, tax_cents, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [order.id, order.customer_id, order.total_cents, order.tax_cents]
    );

    // Insert items and update stock
    for (const item of items) {
      await client.query(
        'INSERT INTO bakeoff_node.order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [uuidv4(), order.id, item.product_id, item.quantity, item.price_cents]
      );

      const result = await client.query(
        'UPDATE bakeoff_node.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.quantity, item.product_id]
      );

      if (result.rowCount === 0) {
        throw new Error('Insufficient stock');
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
