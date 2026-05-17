import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { getOrderById } from '../db/queries.js';

export async function orderByIdHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, pool: Pool) {
  const order = await getOrderById(pool, req.params.id);
  if (!order) {
    reply.status(404).send({ error: 'not found' });
    return;
  }
  reply.status(200).send(order);
}
