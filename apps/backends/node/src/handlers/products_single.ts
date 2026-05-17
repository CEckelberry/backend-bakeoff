import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { getProductById } from '../db/queries.js';

export async function productByIdHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, pool: Pool) {
  const product = await getProductById(pool, req.params.id);
  if (!product) {
    reply.status(404).send({ error: 'not found' });
    return;
  }
  reply.status(200).send(product);
}
