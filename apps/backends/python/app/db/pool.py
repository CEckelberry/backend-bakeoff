import asyncpg
from typing import Optional
from app.config import Config

_pool: Optional[asyncpg.Pool] = None

async def init_pool(config: Config) -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        config.database_url,
        min_size=2,
        max_size=15,
        max_queries=50000,
        max_cached_statement_lifetime=300,
        max_cacheable_statement_size=15000,
    )
    # Test connection
    async with _pool.acquire() as conn:
        await conn.fetchval('SELECT NOW()')
    return _pool

def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError('Pool not initialized')
    return _pool
