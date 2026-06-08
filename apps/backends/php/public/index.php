<?php
// Simple PHP backend for bakeoff
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$_req_start = microtime(true);

// Database connection
$db_host = getenv('DB_HOST') ?: 'db';
$db_port = getenv('DB_PORT') ?: '5432';
$db_name = getenv('DB_DATABASE') ?: 'bakeoff_php';
$db_user = getenv('DB_USERNAME') ?: 'postgres';
$db_pass = getenv('DB_PASSWORD') ?: 'postgres';
$db_schema = getenv('DB_SCHEMA') ?: 'bakeoff_php';

try {
    $pdo = new PDO(
        "pgsql:host=$db_host;port=$db_port;dbname=$db_name",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]
    );

    // Set search_path to use our schema
    $pdo->exec("SET search_path TO $db_schema");
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// ---------------------------------------------------------------------------
// Prometheus metrics — file-based persistence (php -S is share-nothing per
// request, so we use a locked JSON file to accumulate counters across scrapes)
// ---------------------------------------------------------------------------
define('METRICS_FILE', '/tmp/php_metrics.json');
define('BUCKETS', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]);

function set_json_header() {
    header('Content-Type: application/json; charset=utf-8');
}

function record_metric($req_method, $endpoint, $status, $duration) {
    $fp = fopen(METRICS_FILE, 'c+');
    if (!$fp) return;
    flock($fp, LOCK_EX);

    $raw = stream_get_contents($fp);
    $data = ($raw !== false && $raw !== '') ? (json_decode($raw, true) ?? []) : [];

    // Counter
    $ckey = "$req_method:$endpoint:$status";
    $data['counts'][$ckey] = ($data['counts'][$ckey] ?? 0) + 1;

    // Histogram
    $hkey = "$req_method:$endpoint";
    if (!isset($data['hist'][$hkey])) {
        $data['hist'][$hkey] = ['sum' => 0.0, 'count' => 0, 'buckets' => []];
        foreach (BUCKETS as $le) {
            $data['hist'][$hkey]['buckets'][(string)$le] = 0;
        }
    }
    $data['hist'][$hkey]['sum'] += $duration;
    $data['hist'][$hkey]['count']++;
    foreach (BUCKETS as $le) {
        if ($duration <= $le) {
            $data['hist'][$hkey]['buckets'][(string)$le]++;
        }
    }

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data));
    flock($fp, LOCK_UN);
    fclose($fp);
}

// Route: GET /health
if ($path === '/health' && $method === 'GET') {
    set_json_header();
    try {
        $pdo->query('SELECT 1');
        echo json_encode(['status' => 'ok']);
        record_metric('GET', '/health', '200', microtime(true) - $_req_start);
    } catch (Exception $e) {
        http_response_code(503);
        echo json_encode(['error' => 'DB unreachable']);
        record_metric('GET', '/health', '503', microtime(true) - $_req_start);
    }
    exit;
}

// Route: POST /checkout
if ($path === '/checkout' && $method === 'POST') {
    set_json_header();

    try {
        $input = json_decode(file_get_contents('php://input'), true);

        // Validation
        if (!isset($input['customer_id']) || !isset($input['items']) || !isset($input['state'])) {
            throw new Exception('Missing required fields', 400);
        }

        // Validate UUIDs
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $input['customer_id'])) {
            throw new Exception('Invalid customer ID', 400);
        }

        // Validate items
        if (empty($input['items']) || count($input['items']) > 8) {
            throw new Exception('Cart must have 1-8 items', 422);
        }

        $subtotal = 0;
        $order_items = [];

        // Validate products and calculate subtotal
        foreach ($input['items'] as $item) {
            if (!isset($item['product_id']) || !isset($item['quantity'])) {
                throw new Exception('Invalid item structure', 400);
            }

            if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $item['product_id'])) {
                throw new Exception('Invalid product ID', 400);
            }

            $stmt = $pdo->prepare('SELECT id, price_cents, stock FROM products WHERE id = ?');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$product) {
                throw new Exception('Product not found', 404);
            }

            if ($product['stock'] < $item['quantity']) {
                throw new Exception('Insufficient stock', 422);
            }

            $subtotal += $product['price_cents'] * $item['quantity'];
            $order_items[] = [
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'price_cents' => $product['price_cents'],
            ];
        }

        // Call tax service
        $tax_ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => json_encode([
                    'subtotal_cents' => $subtotal,
                    'state' => $input['state'],
                ]),
                'timeout' => 2,
            ]
        ]);

        $tax_url = getenv('TAX_SERVICE_URL') ?: 'http://tax-service:8080';
        $tax_response = @file_get_contents("$tax_url/tax", false, $tax_ctx);

        if ($tax_response === false) {
            throw new Exception('Tax service error', 500);
        }

        $tax_data = json_decode($tax_response, true);
        if (!isset($tax_data['tax_cents'])) {
            throw new Exception('Invalid tax response', 500);
        }

        $tax_cents = $tax_data['tax_cents'];
        $fraud_score = ($subtotal / 100) + (count($order_items) * 10);

        // Start transaction
        $pdo->beginTransaction();

        try {
            // Generate proper UUID v4
            $order_id = sprintf(
                '%08x-%04x-%04x-%04x-%012x',
                mt_rand(0, 0xffffffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0xffffffffffff)
            );

            $total = $subtotal + $tax_cents;

            $stmt = $pdo->prepare(
                'INSERT INTO orders (id, customer_id, total_cents, tax_cents, created_at) VALUES (?, ?, ?, ?, NOW())'
            );
            $stmt->execute([$order_id, $input['customer_id'], $total, $tax_cents]);

            // Create order items
            foreach ($order_items as $item) {
                $item_id = sprintf(
                    '%08x-%04x-%04x-%04x-%012x',
                    mt_rand(0, 0xffffffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffffffffffff)
                );

                $stmt = $pdo->prepare(
                    'INSERT INTO order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES (?, ?, ?, ?, ?, NOW())'
                );
                $stmt->execute([
                    $item_id,
                    $order_id,
                    $item['product_id'],
                    $item['quantity'],
                    $item['price_cents'],
                ]);
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        http_response_code(201);
        echo json_encode([
            'order_id' => $order_id,
            'total_cents' => $total,
            'tax_cents' => $tax_cents,
            'fraud_score' => $fraud_score,
        ]);
        record_metric('POST', '/checkout', '201', microtime(true) - $_req_start);

    } catch (Exception $e) {
        $code = $e->getCode() ?: 500;
        if ($code === 400 || $code === 404 || $code === 422) {
            http_response_code($code);
        } else {
            http_response_code(500);
            $code = 500;
        }
        echo json_encode(['error' => $e->getMessage()]);
        record_metric('POST', '/checkout', (string)$code, microtime(true) - $_req_start);
    }
    exit;
}

// Route: GET /metrics
if ($path === '/metrics' && $method === 'GET') {
    header('Content-Type: text/plain; version=0.0.4; charset=utf-8');

    // Process metrics
    $rusage = getrusage();
    $cpu_seconds = ($rusage['ru_utime.tv_sec'] + $rusage['ru_utime.tv_usec'] / 1e6)
                 + ($rusage['ru_stime.tv_sec'] + $rusage['ru_stime.tv_usec'] / 1e6);
    $rss_bytes = 0;
    if (file_exists('/proc/self/status')) {
        $ps = file_get_contents('/proc/self/status');
        if (preg_match('/VmRSS:\s+(\d+)\s+kB/', $ps, $mm)) {
            $rss_bytes = (int)$mm[1] * 1024;
        }
    }
    if ($rss_bytes === 0) $rss_bytes = memory_get_usage(true);

    echo "# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.\n";
    echo "# TYPE process_cpu_seconds_total gauge\n";
    echo "process_cpu_seconds_total $cpu_seconds\n";
    echo "# HELP process_resident_memory_bytes Resident memory size in bytes.\n";
    echo "# TYPE process_resident_memory_bytes gauge\n";
    echo "process_resident_memory_bytes $rss_bytes\n";

    // HTTP metrics from persistent file
    $fp = fopen(METRICS_FILE, 'c+');
    if ($fp) {
        flock($fp, LOCK_SH);
        $raw = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        $data = ($raw !== '' && $raw !== false) ? (json_decode($raw, true) ?? []) : [];
    } else {
        $data = [];
    }

    echo "# HELP http_requests_total Total HTTP requests.\n";
    echo "# TYPE http_requests_total counter\n";
    foreach ($data['counts'] ?? [] as $key => $count) {
        [$m, $e, $s] = explode(':', $key, 3);
        echo "http_requests_total{method=\"$m\",endpoint=\"$e\",status=\"$s\"} $count\n";
    }

    echo "# HELP http_request_duration_seconds HTTP request duration in seconds.\n";
    echo "# TYPE http_request_duration_seconds histogram\n";
    foreach ($data['hist'] ?? [] as $key => $h) {
        [$m, $e] = explode(':', $key, 2);
        $inf = $h['count'];
        foreach ($h['buckets'] as $le => $cnt) {
            echo "http_request_duration_seconds_bucket{method=\"$m\",endpoint=\"$e\",le=\"$le\"} $cnt\n";
        }
        echo "http_request_duration_seconds_bucket{method=\"$m\",endpoint=\"$e\",le=\"+Inf\"} $inf\n";
        echo "http_request_duration_seconds_sum{method=\"$m\",endpoint=\"$e\"} {$h['sum']}\n";
        echo "http_request_duration_seconds_count{method=\"$m\",endpoint=\"$e\"} {$h['count']}\n";
    }
    exit;
}

// Route: GET /products
if ($path === '/products' && $method === 'GET') {
    set_json_header();
    $rows = $pdo->query('SELECT id, sku, name, price_cents, stock FROM products ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['products' => $rows]);
    record_metric('GET', '/products', '200', microtime(true) - $_req_start);
    exit;
}

// Route: GET /products/{id}
if (preg_match('#^/products/([0-9a-f-]+)$#i', $path, $m) && $method === 'GET') {
    set_json_header();
    $stmt = $pdo->prepare('SELECT id, sku, name, price_cents, stock FROM products WHERE id = ?');
    $stmt->execute([$m[1]]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        record_metric('GET', '/products/:id', '404', microtime(true) - $_req_start);
    } else {
        echo json_encode($row);
        record_metric('GET', '/products/:id', '200', microtime(true) - $_req_start);
    }
    exit;
}

// Route: GET /orders/recent
if ($path === '/orders/recent' && $method === 'GET') {
    set_json_header();
    $rows = $pdo->query(
        'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 20'
    )->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['orders' => $rows]);
    record_metric('GET', '/orders/recent', '200', microtime(true) - $_req_start);
    exit;
}

// Route: GET /orders/{id}
if (preg_match('#^/orders/([0-9a-f-]+)$#i', $path, $m) && $method === 'GET') {
    set_json_header();
    $stmt = $pdo->prepare('SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders WHERE id = ?');
    $stmt->execute([$m[1]]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        record_metric('GET', '/orders/:id', '404', microtime(true) - $_req_start);
        exit;
    }
    $stmt2 = $pdo->prepare('SELECT product_id, quantity, price_cents FROM order_items WHERE order_id = ?');
    $stmt2->execute([$m[1]]);
    $order['items'] = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($order);
    record_metric('GET', '/orders/:id', '200', microtime(true) - $_req_start);
    exit;
}

// Route: GET /reports/revenue
if ($path === '/reports/revenue' && $method === 'GET') {
    set_json_header();
    $rows = $pdo->query(
        "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents
         FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY date DESC"
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['order_count'] = (int)$r['order_count'];
        $r['revenue_cents'] = (int)$r['revenue_cents'];
    }
    echo json_encode(['report' => $rows]);
    record_metric('GET', '/reports/revenue', '200', microtime(true) - $_req_start);
    exit;
}

// 404
http_response_code(404);
set_json_header();
echo json_encode(['error' => 'Not found']);
exit;
