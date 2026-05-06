<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Prometheus\CollectorRegistry;
use Prometheus\Storage\InMemory;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CollectorRegistry::class, function () {
            return new CollectorRegistry(new InMemory());
        });

        // Register Prometheus metrics
        $registry = $this->app->make(CollectorRegistry::class);

        // HTTP metrics
        $registry->registerCounter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status'],
        );

        $registry->registerHistogram(
            'http_request_duration_seconds',
            'HTTP request duration',
            ['method', 'endpoint'],
            [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
        );
    }

    public function boot(): void
    {
    }
}
