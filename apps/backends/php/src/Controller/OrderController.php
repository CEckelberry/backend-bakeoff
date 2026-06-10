<?php

namespace App\Controller;

use App\Service\DbService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class OrderController
{
    public function __construct(private readonly DbService $db) {}

    #[Route('/orders/recent', methods: ['GET'])]
    public function recent(): JsonResponse
    {
        $rows = $this->db->pdo()->query(
            'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 20'
        )->fetchAll(\PDO::FETCH_ASSOC);
        return new JsonResponse(['orders' => $rows]);
    }

    #[Route('/orders/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders WHERE id = ?'
        );
        $stmt->execute([$id]);
        $order = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$order) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        $stmt2 = $this->db->pdo()->prepare(
            'SELECT product_id, quantity, price_cents FROM order_items WHERE order_id = ?'
        );
        $stmt2->execute([$id]);
        $order['items'] = $stmt2->fetchAll(\PDO::FETCH_ASSOC);
        return new JsonResponse($order);
    }

    #[Route('/reports/revenue', methods: ['GET'])]
    public function revenue(): JsonResponse
    {
        $rows = $this->db->pdo()->query(
            "SELECT DATE(created_at) AS date, COUNT(*) AS order_count, SUM(total_cents) AS revenue_cents
             FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at) ORDER BY date DESC"
        )->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['order_count']   = (int) $r['order_count'];
            $r['revenue_cents'] = (int) $r['revenue_cents'];
        }
        return new JsonResponse(['report' => $rows]);
    }
}
