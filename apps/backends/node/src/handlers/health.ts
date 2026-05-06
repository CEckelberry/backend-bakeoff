import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function healthHandler(req: FastifyRequest, reply: FastifyReply, pool: Pool) {
  try {
    await pool.query('SELECT 1');
    reply.status(200).send({ status: 'ok' });
  } catch (error) {
    reply.status(503).send({ error: 'DB unreachable' });
  }
}
