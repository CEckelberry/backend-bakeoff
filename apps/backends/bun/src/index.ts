import { Hono } from 'hono';
import { loadConfig } from './config';
import { initPool } from './db/pool';
import { handleHealth } from './handlers/health';
import { handleCheckout } from './handlers/checkout';
import { handleMetrics } from './handlers/metrics';

const config = loadConfig();
const app = new Hono();

let pool: any;

// Initialize pool on startup
const initializeApp = async () => {
  try {
    pool = await initPool(config.databaseUrl);
    console.log(JSON.stringify({ runtime: 'bun', status: 'startup', message: 'Database connected' }));
  } catch (e) {
    console.error(JSON.stringify({ runtime: 'bun', status: 'startup_failed', error: String(e) }));
    process.exit(1);
  }
};

// Top-level await for initialization
await initializeApp();

// Routes
app.get('/health', (c) => handleHealth(c, pool));
app.post('/checkout', (c) => handleCheckout(c, pool, config.taxServiceUrl));
app.get('/metrics', (c) => handleMetrics(c));

// Start server using Bun's native serve
Bun.serve({
  port: config.listenPort,
  hostname: config.listenAddr,
  fetch: app.fetch,
});

export default app;
