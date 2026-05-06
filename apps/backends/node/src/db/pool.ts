import { Pool } from 'pg';
import { Config } from '../config.js';

let pool: Pool;

export async function initPool(config: Config): Promise<Pool> {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  await pool.query('SELECT NOW()');
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Pool not initialized');
  return pool;
}
