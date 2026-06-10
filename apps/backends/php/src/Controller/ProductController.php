<?php

namespace App\Controller;

use App\Service\DbService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class ProductController
{
    public function __construct(private readonly DbService $db) {}

    #[Route('/products', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $rows = $this->db->pdo()
            ->query('SELECT id, sku, name, price_cents, stock FROM products ORDER BY name')
            ->fetchAll(\PDO::FETCH_ASSOC);
        return new JsonResponse(['products' => $rows]);
    }

    #[Route('/products/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $stmt = $this->db->pdo()->prepare('SELECT id, sku, name, price_cents, stock FROM products WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            return new JsonResponse(['error' => 'not found'], 404);
        }
        return new JsonResponse($row);
    }
}
