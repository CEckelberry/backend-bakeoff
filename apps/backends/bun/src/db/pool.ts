import postgres from 'postgres';

let pool: postgres.Sql;

export async function initPool(databaseUrl: string): Promise<postgres.Sql> {
  pool = postgres(databaseUrl, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  // Test connection
  await pool`SELECT NOW()`;
  return pool;
}

export function getPool(): postgres.Sql {
  if (!pool) {
    throw new Error('Pool not initialized');
  }
  return pool;
}
