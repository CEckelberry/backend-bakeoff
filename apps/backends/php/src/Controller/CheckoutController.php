<?php

namespace App\Controller;

use App\Service\DbService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class CheckoutController
{
    public function __construct(private readonly DbService $db) {}

    #[Route('/checkout', methods: ['POST'])]
    public function checkout(Request $request): JsonResponse
    {
        $input = json_decode($request->getContent(), true);

        if (!isset($input['customer_id'], $input['items'], $input['state'])) {
            return new JsonResponse(['error' => 'Missing required fields'], 400);
        }
        if (!$this->isUuid($input['customer_id'])) {
            return new JsonResponse(['error' => 'Invalid customer ID'], 400);
        }
        if (empty($input['items']) || count($input['items']) > 8) {
            return new JsonResponse(['error' => 'Cart must have 1–8 items'], 422);
        }

        $pdo      = $this->db->pdo();
        $subtotal = 0;
        $orderItems = [];

        foreach ($input['items'] as $item) {
            if (!isset($item['product_id'], $item['quantity']) || !$this->isUuid($item['product_id'])) {
                return new JsonResponse(['error' => 'Invalid item structure'], 400);
            }
            $stmt = $pdo->prepare('SELECT id, price_cents, stock FROM products WHERE id = ?');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$product) {
                return new JsonResponse(['error' => 'Product not found'], 404);
            }
            if ($product['stock'] < $item['quantity']) {
                return new JsonResponse(['error' => 'Insufficient stock'], 422);
            }

            $subtotal     += $product['price_cents'] * $item['quantity'];
            $orderItems[]  = [
                'product_id'  => $item['product_id'],
                'quantity'    => (int) $item['quantity'],
                'price_cents' => (int) $product['price_cents'],
            ];
        }

        // Tax service
        $taxUrl = getenv('TAX_SERVICE_URL') ?: 'http://tax-service:8080';
        $ctx    = stream_context_create(['http' => [
            'method'          => 'POST',
            'header'          => "Content-Type: application/json\r\n",
            'content'         => json_encode(['subtotal_cents' => $subtotal, 'state' => $input['state']]),
            'timeout'         => 2,
            'ignore_errors'   => true,
        ]]);
        $taxRaw = @file_get_contents("{$taxUrl}/tax", false, $ctx);
        if ($taxRaw === false) {
            return new JsonResponse(['error' => 'Tax service error'], 500);
        }
        $taxData  = json_decode($taxRaw, true);
        $taxCents = (int) ($taxData['tax_cents'] ?? 0);

        $fraudScore = ($subtotal / 100) + (count($orderItems) * 10);

        try {
            $pdo->beginTransaction();

            $orderId = $this->uuidV4();
            $total   = $subtotal + $taxCents;

            $pdo->prepare('INSERT INTO orders (id, customer_id, total_cents, tax_cents, created_at) VALUES (?, ?, ?, ?, NOW())')
                ->execute([$orderId, $input['customer_id'], $total, $taxCents]);

            $itemStmt = $pdo->prepare(
                'INSERT INTO order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES (?, ?, ?, ?, ?, NOW())'
            );
            foreach ($orderItems as $oi) {
                $itemStmt->execute([$this->uuidV4(), $orderId, $oi['product_id'], $oi['quantity'], $oi['price_cents']]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }

        return new JsonResponse([
            'order_id'    => $orderId,
            'total_cents' => $total,
            'tax_cents'   => $taxCents,
            'fraud_score' => $fraudScore,
        ], 201);
    }

    private function isUuid(string $v): bool
    {
        return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $v);
    }

    private function uuidV4(): string
    {
        $b    = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}
