<?php

declare(strict_types=1);

use Swoole\HTTP\Server;
use Swoole\HTTP\Request;
use Swoole\HTTP\Response;
use Swoole\Table;

// Standard Prometheus histogram buckets
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];

// ---------------------------------------------------------------------------
// Shared-memory metrics table — allocated before fork so all workers share it.
// Keys: "method:endpoint:status" for counters, "method:endpoint:bucket:N" /
// "method:endpoint:sum" / "method:endpoint:count" for histograms.
// Table::incr() is atomic, no locking needed.
// ---------------------------------------------------------------------------
$metrics = new Table(16384);
$metrics->column('v', Table::TYPE_FLOAT);
$metrics->create();

$server = new Server('0.0.0.0', 8086);
$server->set([
    'worker_num'       => 4,
    'enable_coroutine' => true,
    'hook_flags'       => SWOOLE_HOOK_ALL,  // makes file_get_contents + PDO coroutine-aware
    'log_level'        => SWOOLE_LOG_ERROR,
]);

// Per-worker persistent PDO connection — each forked worker gets its own.
$workerPdo = null;

$server->on('WorkerStart', function (Server $svr, int $id) use (&$workerPdo): void {
    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        getenv('DB_HOST') ?: 'localhost',
        getenv('DB_PORT') ?: '5432',
        getenv('DB_DATABASE') ?: 'bakeoff'
    );
    $workerPdo = new PDO($dsn, getenv('DB_USERNAME') ?: 'postgres', getenv('DB_PASSWORD') ?: 'password', [
        PDO::ATTR_ERRMODE      => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_PERSISTENT   => false,
    ]);
    $schema = getenv('DB_SCHEMA') ?: 'bakeoff_php';
    $workerPdo->exec("SET search_path TO {$schema}");
});

$server->on('request', function (Request $req, Response $res) use (&$workerPdo, $metrics): void {
    $t0     = hrtime(true);
    $path   = $req->server['request_uri'] ?? '/';
    $method = strtoupper($req->server['request_method'] ?? 'GET');

    [$status, $body, $ct] = dispatch($req, $method, $path, $workerPdo, $metrics);

    if ($path !== '/metrics') {
        $elapsed  = (hrtime(true) - $t0) / 1e9;
        $endpoint = normalizePath($path);
        recordMetric($metrics, $method, $endpoint, (string)$status, $elapsed);
    }

    $res->status($status);
    $res->header('Content-Type', $ct);
    $res->end($body);
});

$server->start();

// ---------------------------------------------------------------------------

function dispatch(Request $req, string $method, string $path, PDO $pdo, Table $metrics): array
{
    $json = 'application/json; charset=utf-8';

    if ($path === '/health' && $method === 'GET') {
        return routeHealth($pdo, $json);
    }
    if ($path === '/checkout' && $method === 'POST') {
        return routeCheckout($req, $pdo, $json);
    }
    if ($path === '/metrics' && $method === 'GET') {
        return [200, renderMetrics($metrics), 'text/plain; version=0.0.4; charset=utf-8'];
    }
    if ($path === '/products' && $method === 'GET') {
        return routeProducts($pdo, $json);
    }
    if (preg_match('#^/products/([0-9a-f\-]+)$#i', $path, $m) && $method === 'GET') {
        return routeProductById($pdo, $m[1], $json);
    }
    if ($path === '/orders/recent' && $method === 'GET') {
        return routeRecentOrders($pdo, $json);
    }
    if (preg_match('#^/orders/([0-9a-f\-]+)$#i', $path, $m) && $method === 'GET') {
        return routeOrderById($pdo, $m[1], $json);
    }
    if ($path === '/reports/revenue' && $method === 'GET') {
        return routeRevenue($pdo, $json);
    }

    return [404, json_encode(['error' => 'Not found']), $json];
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function routeHealth(PDO $pdo, string $ct): array
{
    try {
        $pdo->query('SELECT 1');
        return [200, json_encode(['status' => 'ok']), $ct];
    } catch (\Throwable $e) {
        return [503, json_encode(['error' => 'DB unreachable']), $ct];
    }
}

function routeCheckout(Request $req, PDO $pdo, string $ct): array
{
    try {
        $input = json_decode($req->rawContent(), true);

        if (!isset($input['customer_id'], $input['items'], $input['state'])) {
            return [400, json_encode(['error' => 'Missing required fields']), $ct];
        }
        if (!isUuid($input['customer_id'])) {
            return [400, json_encode(['error' => 'Invalid customer ID']), $ct];
        }
        if (empty($input['items']) || count($input['items']) > 8) {
            return [422, json_encode(['error' => 'Cart must have 1–8 items']), $ct];
        }

        $subtotal   = 0;
        $orderItems = [];

        foreach ($input['items'] as $item) {
            if (!isset($item['product_id'], $item['quantity']) || !isUuid($item['product_id'])) {
                return [400, json_encode(['error' => 'Invalid item structure']), $ct];
            }
            $stmt = $pdo->prepare('SELECT id, price_cents, stock FROM products WHERE id = ?');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$product) {
                return [404, json_encode(['error' => 'Product not found']), $ct];
            }
            if ($product['stock'] < $item['quantity']) {
                return [422, json_encode(['error' => 'Insufficient stock']), $ct];
            }

            $subtotal     += $product['price_cents'] * $item['quantity'];
            $orderItems[]  = [
                'product_id'  => $item['product_id'],
                'quantity'    => (int)$item['quantity'],
                'price_cents' => (int)$product['price_cents'],
            ];
        }

        // Tax service call — non-blocking via SWOOLE_HOOK_ALL
        $taxUrl = getenv('TAX_SERVICE_URL') ?: 'http://tax-service:8080';
        $ctx    = stream_context_create(['http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\n",
            'content' => json_encode(['subtotal_cents' => $subtotal, 'state' => $input['state']]),
            'timeout' => 2,
        ]]);
        $taxRaw = @file_get_contents("{$taxUrl}/tax", false, $ctx);
        if ($taxRaw === false) {
            return [500, json_encode(['error' => 'Tax service error']), $ct];
        }
        $taxData  = json_decode($taxRaw, true);
        $taxCents = (int)($taxData['tax_cents'] ?? 0);

        $fraudScore = ($subtotal / 100) + (count($orderItems) * 10);

        $pdo->beginTransaction();
        try {
            $orderId = uuidV4();
            $total   = $subtotal + $taxCents;

            $pdo->prepare('INSERT INTO orders (id, customer_id, total_cents, tax_cents, created_at) VALUES (?, ?, ?, ?, NOW())')
                ->execute([$orderId, $input['customer_id'], $total, $taxCents]);

            $itemStmt = $pdo->prepare('INSERT INTO order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
            foreach ($orderItems as $oi) {
                $itemStmt->execute([uuidV4(), $orderId, $oi['product_id'], $oi['quantity'], $oi['price_cents']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return [201, json_encode([
            'order_id'    => $orderId,
            'total_cents' => $total,
            'tax_cents'   => $taxCents,
            'fraud_score' => $fraudScore,
        ]), $ct];
    } catch (\Throwable $e) {
        return [500, json_encode(['error' => $e->getMessage()]), $ct];
    }
}

function routeProducts(PDO $pdo, string $ct): array
{
    $rows = $pdo->query('SELECT id, sku, name, price_cents, stock FROM products ORDER BY name')
                ->fetchAll(\PDO::FETCH_ASSOC);
    return [200, json_encode(['products' => $rows]), $ct];
}

function routeProductById(PDO $pdo, string $id, string $ct): array
{
    $stmt = $pdo->prepare('SELECT id, sku, name, price_cents, stock FROM products WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(\PDO::FETCH_ASSOC);
    if (!$row) {
        return [404, json_encode(['error' => 'not found']), $ct];
    }
    return [200, json_encode($row), $ct];
}

function routeRecentOrders(PDO $pdo, string $ct): array
{
    $rows = $pdo->query(
        'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 20'
    )->fetchAll(\PDO::FETCH_ASSOC);
    return [200, json_encode(['orders' => $rows]), $ct];
}

function routeOrderById(PDO $pdo, string $id, string $ct): array
{
    $stmt = $pdo->prepare('SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $order = $stmt->fetch(\PDO::FETCH_ASSOC);
    if (!$order) {
        return [404, json_encode(['error' => 'not found']), $ct];
    }
    $stmt2 = $pdo->prepare('SELECT product_id, quantity, price_cents FROM order_items WHERE order_id = ?');
    $stmt2->execute([$id]);
    $order['items'] = $stmt2->fetchAll(\PDO::FETCH_ASSOC);
    return [200, json_encode($order), $ct];
}

function routeRevenue(PDO $pdo, string $ct): array
{
    $rows = $pdo->query(
        "SELECT DATE(created_at) AS date, COUNT(*) AS order_count, SUM(total_cents) AS revenue_cents
         FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY date DESC"
    )->fetchAll(\PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['order_count']   = (int)$r['order_count'];
        $r['revenue_cents'] = (int)$r['revenue_cents'];
    }
    return [200, json_encode(['report' => $rows]), $ct];
}

// ---------------------------------------------------------------------------
// Prometheus metrics
// ---------------------------------------------------------------------------

function recordMetric(Table $t, string $method, string $endpoint, string $status, float $duration): void
{
    // Counter
    $t->incr("{$method}:{$endpoint}:{$status}", 'v', 1);

    // Histogram
    $base = "{$method}:{$endpoint}";
    $t->incr("{$base}:sum", 'v', $duration);
    $t->incr("{$base}:count", 'v', 1);
    foreach (BUCKETS as $le) {
        if ($duration <= $le) {
            $t->incr("{$base}:b:{$le}", 'v', 1);
        }
    }
}

function renderMetrics(Table $t): string
{
    // RSS memory
    $rss = 0;
    if (file_exists('/proc/self/status')) {
        if (preg_match('/VmRSS:\s+(\d+)\s+kB/', (string)file_get_contents('/proc/self/status'), $mm)) {
            $rss = (int)$mm[1] * 1024;
        }
    }
    if ($rss === 0) {
        $rss = memory_get_usage(true);
    }

    $out  = "# HELP process_resident_memory_bytes Resident memory size in bytes.\n";
    $out .= "# TYPE process_resident_memory_bytes gauge\n";
    $out .= "process_resident_memory_bytes {$rss}\n";

    // Reconstruct counters and histograms from the flat table
    $counts = [];   // "method:endpoint:status" => count
    $hists  = [];   // "method:endpoint" => ['sum'=>..., 'count'=>..., 'buckets'=>[le=>cnt,...]]

    foreach ($t as $key => $row) {
        $parts = explode(':', $key, 4);
        if (count($parts) === 3) {
            // Counter: method:endpoint:status
            $counts[$key] = $row['v'];
        } elseif (count($parts) === 4) {
            [$m, $e, $type, $sub] = $parts;
            $base = "{$m}:{$e}";
            if ($type === 'sum') {
                $hists[$base]['sum'] = $row['v'];
            } elseif ($type === 'count') {
                $hists[$base]['count'] = $row['v'];
            } elseif ($type === 'b') {
                $hists[$base]['buckets'][$sub] = $row['v'];
            }
        }
    }

    $out .= "# HELP http_requests_total Total HTTP requests.\n";
    $out .= "# TYPE http_requests_total counter\n";
    foreach ($counts as $key => $v) {
        [$m, $e, $s] = explode(':', $key, 3);
        $out .= "http_requests_total{method=\"{$m}\",endpoint=\"{$e}\",status=\"{$s}\"} {$v}\n";
    }

    $out .= "# HELP http_request_duration_seconds HTTP request duration in seconds.\n";
    $out .= "# TYPE http_request_duration_seconds histogram\n";
    foreach ($hists as $base => $h) {
        [$m, $e] = explode(':', $base, 2);
        $buckets = $h['buckets'] ?? [];
        $inf     = (int)($h['count'] ?? 0);
        // Emit in ascending bucket order
        usort($blist = array_keys($buckets), fn($a, $b) => (float)$a <=> (float)$b);
        foreach ($blist as $le) {
            $out .= "http_request_duration_seconds_bucket{method=\"{$m}\",endpoint=\"{$e}\",le=\"{$le}\"} {$buckets[$le]}\n";
        }
        $out .= "http_request_duration_seconds_bucket{method=\"{$m}\",endpoint=\"{$e}\",le=\"+Inf\"} {$inf}\n";
        $out .= "http_request_duration_seconds_sum{method=\"{$m}\",endpoint=\"{$e}\"} " . ($h['sum'] ?? 0) . "\n";
        $out .= "http_request_duration_seconds_count{method=\"{$m}\",endpoint=\"{$e}\"} {$inf}\n";
    }

    return $out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(string $path): string
{
    $parts = explode('/', $path);
    foreach ($parts as &$seg) {
        // UUID v4 pattern
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $seg)) {
            $seg = ':id';
        }
    }
    return implode('/', $parts);
}

function isUuid(string $v): bool
{
    return (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $v);
}

function uuidV4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
