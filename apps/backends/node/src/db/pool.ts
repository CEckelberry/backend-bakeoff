import { Pool } from 'pg';
import { Config } from '../config.js';

let pool: Pool;

export async function initPool(config: Config): Promise<Pool> {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    min: 1,
    idleTimeoutMillis: 600000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection
  await pool.query('SELECT NOW()');
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Pool not initialized');
  return pool;
}
