import asyncpg

async def health(pool: asyncpg.Pool) -> dict:
    try:
        await pool.fetchval('SELECT 1')
        return {'status': 'ok'}
    except Exception:
        raise ValueError('DB unreachable')
