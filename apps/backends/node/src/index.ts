import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { initPool } from './db/pool.js';
import { healthHandler } from './handlers/health.js';
import { checkoutHandler } from './handlers/checkout.js';
import { metricsHandler } from './handlers/metrics.js';
import { v4 as uuidv4 } from 'uuid';
import { Counter, Histogram } from 'prom-client';
import { FastifyRequest, FastifyReply } from 'fastify';

const config = loadConfig();

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status'],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'endpoint'],
});

async function main() {
  const pool = await initPool(config);

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Request ID and Timing Hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    (request as any).id = request.headers['x-request-id'] || uuidv4();
    (request as any).startTime = Date.now();
  });

  // Metrics and Logging Hook
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime || Date.now();
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const path = request.url;
    const method = request.method;
    const status = reply.statusCode.toString();

    httpRequestsTotal.labels(method, path, status).inc();
    httpRequestDurationSeconds.labels(method, path).observe(durationSec);

    request.log.info({ 
      requestId: (request as any).id, 
      duration_ms: durationMs, 
      runtime: config.runtimeName,
      status 
    }, 'request processed');
  });

  fastify.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    return healthHandler(req, reply, pool);
  });
  
  fastify.post('/checkout', async (req: FastifyRequest, reply: FastifyReply) => {
    return checkoutHandler(req, reply, pool, config.taxServiceUrl);
  });
  
  fastify.get('/metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    return metricsHandler(req, reply);
  });

  try {
    await fastify.listen({ port: config.listenPort, host: config.listenAddr });
    console.log(`Node.js backend listening on ${config.listenAddr}:${config.listenPort}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
