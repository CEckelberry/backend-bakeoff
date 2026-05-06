<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;

class MetricsController extends Controller
{
    public function __invoke(): Response
    {
        // Get the global registry
        $registry = app(CollectorRegistry::class);

        // Render metrics
        $renderer = new RenderTextFormat();
        $result = $renderer->render($registry->collect());

        return response($result, 200, [
            'Content-Type' => 'text/plain; version=0.0.4; charset=utf-8',
        ]);
    }
}
