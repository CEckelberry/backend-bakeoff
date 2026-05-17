import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function ordersRecentHandler(req: FastifyRequest, reply: FastifyReply, pool: Pool) {
  const result = await pool.query(
    'SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_node.orders ORDER BY created_at DESC LIMIT 20'
  );
  reply.status(200).send({ orders: result.rows });
}
