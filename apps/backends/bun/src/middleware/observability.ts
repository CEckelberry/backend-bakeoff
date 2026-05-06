import { MiddlewareHandler } from 'hono';
import { Counter, Histogram } from 'prom-client';
import { createRequestLogger } from '../utils/logging';
import { Config } from '../config';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status'],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'endpoint'],
});

export function observabilityMiddleware(config: Config): MiddlewareHandler {
  return async (c, next) => {
    const startTime = performance.now();
    const requestId = c.req.headers.get('x-request-id') || crypto.randomUUID();

    await next();

    const durationMs = performance.now() - startTime;
    const durationSec = durationMs / 1000;

    const method = c.req.method;
    const path = c.req.url.split('?')[0];
    const status = c.res.status;

    httpRequestsTotal.inc({ method, endpoint: path, status });
    httpRequestDurationSeconds.observe({ method, endpoint: path }, durationSec);

    const logger = createRequestLogger(requestId, config.runtimeName);
    logger.logRequest(method, path, status, durationMs);
  };
}
