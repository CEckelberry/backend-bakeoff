import { FastifyRequest, FastifyReply } from 'fastify';
import { register } from 'prom-client';

export async function metricsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.type('text/plain').send(await register.metrics());
}
