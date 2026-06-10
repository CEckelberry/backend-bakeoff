<?php

namespace App\Controller;

use App\Service\MetricsService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class MetricsController
{
    public function __construct(private readonly MetricsService $metrics) {}

    #[Route('/metrics', methods: ['GET'])]
    public function metrics(): Response
    {
        return new Response(
            $this->metrics->render(),
            200,
            ['Content-Type' => 'text/plain; version=0.0.4; charset=utf-8']
        );
    }
}
