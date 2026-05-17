import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function revenueHandler(req: FastifyRequest, reply: FastifyReply, pool: Pool) {
  const result = await pool.query(
    "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents FROM bakeoff_node.orders WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date DESC"
  );
  const report = result.rows.map((r) => ({
    date: r.date,
    order_count: parseInt(r.order_count, 10),
    revenue_cents: parseInt(r.revenue_cents, 10),
  }));
  reply.status(200).send({ report });
}
