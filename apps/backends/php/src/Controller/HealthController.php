<?php

namespace App\Controller;

use App\Service\DbService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class HealthController
{
    public function __construct(private readonly DbService $db) {}

    #[Route('/health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        try {
            $this->db->pdo()->query('SELECT 1');
            return new JsonResponse(['status' => 'ok']);
        } catch (\Throwable) {
            return new JsonResponse(['error' => 'DB unreachable'], 503);
        }
    }
}
