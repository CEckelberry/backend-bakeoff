import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function productsHandler(req: FastifyRequest, reply: FastifyReply, pool: Pool) {
  const result = await pool.query(
    'SELECT id, sku, name, price_cents, stock FROM bakeoff_node.products ORDER BY name'
  );
  reply.status(200).send({ products: result.rows });
}
