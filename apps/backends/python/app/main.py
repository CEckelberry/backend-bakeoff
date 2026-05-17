from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram
import time
import uuid as uuid_module
import structlog
from app.config import load_config, Config
from app.db.pool import init_pool, get_pool
from app.handlers import health, checkout, metrics, products, orders
from app.utils.logging import setup_logging
from app.models.types import CheckoutRequest
import asyncpg

config = load_config()
setup_logging(config.log_level)
logger = structlog.get_logger()

app = FastAPI(title='Backend Bakeoff - Python')

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    labelnames=['method', 'endpoint', 'status'],
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    labelnames=['method', 'endpoint'],
)

@app.on_event('startup')
async def startup():
    await init_pool(config)
    logger.msg('Python backend startup', runtime='python')

@app.get('/health')
async def health_endpoint(pool: asyncpg.Pool = Depends(get_pool)):
    try:
        result = await health.health(pool)
        return result
    except Exception as e:
        raise JSONResponse(status_code=503, content={'error': str(e)})

@app.post('/checkout', status_code=201)
async def checkout_endpoint(
    req: CheckoutRequest,
    pool: asyncpg.Pool = Depends(get_pool),
    cfg: Config = Depends(load_config),
):
    return await checkout.checkout(req, pool, cfg.tax_service_url)

@app.get('/products')
async def products_endpoint(pool: asyncpg.Pool = Depends(get_pool)):
    return await products.products(pool)

@app.get('/products/{product_id}')
async def product_by_id_endpoint(product_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    return await products.product_by_id(product_id, pool)

@app.get('/orders/recent')
async def orders_recent_endpoint(pool: asyncpg.Pool = Depends(get_pool)):
    return await orders.recent_orders(pool)

@app.get('/orders/{order_id}')
async def order_by_id_endpoint(order_id: str, pool: asyncpg.Pool = Depends(get_pool)):
    return await orders.order_by_id(order_id, pool)

@app.get('/reports/revenue')
async def revenue_report_endpoint(pool: asyncpg.Pool = Depends(get_pool)):
    return await orders.revenue_report(pool)

@app.get('/metrics')
async def metrics_endpoint():
    return await metrics.metrics()

@app.middleware('http')
async def add_observability(request: Request, call_next):
    request_id = request.headers.get('x-request-id', str(uuid_module.uuid4()))
    start_time = time.time()

    response = await call_next(request)

    duration_ms = (time.time() - start_time) * 1000
    duration_sec = duration_ms / 1000

    method = request.method
    path = request.url.path
    status = response.status_code

    http_requests_total.labels(method, path, status).inc()
    http_request_duration_seconds.labels(method, path).observe(duration_sec)

    logger.msg(
        'request processed',
        request_id=request_id,
        duration_ms=round(duration_ms),
        runtime=config.runtime_name,
        status=status,
    )

    return response
