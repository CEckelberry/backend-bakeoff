<?php
// Simple PHP backend for bakeoff
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

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

// Prometheus metrics registry
$metrics_registry = [];

function set_json_header() {
    header('Content-Type: application/json; charset=utf-8');
}

function record_metric($method, $endpoint, $status, $duration) {
    global $metrics_registry;
    $key = "$method:$endpoint:$status";
    if (!isset($metrics_registry[$key])) {
        $metrics_registry[$key] = ['count' => 0, 'durations' => []];
    }
    $metrics_registry[$key]['count']++;
    $metrics_registry[$key]['durations'][] = $duration;
}

// Route: GET /health
if ($path === '/health' && $method === 'GET') {
    set_json_header();
    try {
        $pdo->query('SELECT 1');
        echo json_encode(['status' => 'ok']);
        record_metric('GET', '/health', '200', 0.001);
    } catch (Exception $e) {
        http_response_code(503);
        echo json_encode(['error' => 'DB unreachable']);
        record_metric('GET', '/health', '503', 0.001);
    }
    exit;
}

// Route: POST /checkout
if ($path === '/checkout' && $method === 'POST') {
    set_json_header();
    $start = microtime(true);
    
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
            // Create order
            $order_id = str_replace('-', '', uniqid('', true));
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
        
        $duration = microtime(true) - $start;
        record_metric('POST', '/checkout', '201', $duration);
        
    } catch (Exception $e) {
        $duration = microtime(true) - $start;
        $code = $e->getCode() ?: 500;
        
        if ($code === 400 || $code === 404 || $code === 422) {
            http_response_code($code);
        } else {
            http_response_code(500);
            $code = 500;
        }
        
        echo json_encode(['error' => $e->getMessage()]);
        record_metric('POST', '/checkout', (string)$code, $duration);
    }
    exit;
}

// Route: GET /metrics
if ($path === '/metrics' && $method === 'GET') {
    header('Content-Type: text/plain; version=0.0.4; charset=utf-8');
    
    // For now, return empty metrics (Prometheus format)
    // Could be enhanced with actual metrics collection
    echo "# HELP http_requests_total Total HTTP requests\n";
    echo "# TYPE http_requests_total counter\n";
    echo "http_requests_total{method=\"GET\",endpoint=\"/health\",status=\"200\"} 0\n";
    echo "http_requests_total{method=\"POST\",endpoint=\"/checkout\",status=\"201\"} 0\n";
    echo "# HELP http_request_duration_seconds HTTP request duration\n";
    echo "# TYPE http_request_duration_seconds histogram\n";
    exit;
}

// 404
http_response_code(404);
set_json_header();
echo json_encode(['error' => 'Not found']);
exit;
