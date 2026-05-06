import postgres from 'postgres';
import { Context } from 'hono';

export async function handleHealth(c: Context, pool: postgres.Sql): Promise<Response> {
  try {
    await pool`SELECT 1`;
    return c.json({ status: 'ok' });
  } catch (e) {
    return c.json({ error: 'DB unreachable' }, 503);
  }
}
