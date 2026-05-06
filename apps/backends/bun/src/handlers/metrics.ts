import { Context } from 'hono';
import { register } from 'prom-client';

export async function handleMetrics(c: Context): Promise<Response> {
  const metrics = await register.metrics();
  return c.text(metrics);
}
