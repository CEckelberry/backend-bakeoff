import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { processCheckout } from '../services/checkout.js';
import { CheckoutRequest } from '../types.js';

export async function checkoutHandler(
  req: FastifyRequest,
  reply: FastifyReply,
  pool: Pool,
  taxServiceUrl: string
) {
  try {
    const result = await processCheckout(req.body as CheckoutRequest, pool, taxServiceUrl);
    reply.status(201).send(result);
  } catch (error: any) {
    const msg = error.message || 'Internal server error';
    if (msg.includes('Invalid')) {
      reply.status(400).send({ error: msg });
    } else if (msg.includes('stock') || msg.includes('Cart must')) {
      reply.status(422).send({ error: msg });
    } else {
      reply.status(500).send({ error: msg });
    }
  }
}
