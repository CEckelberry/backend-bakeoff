<?php

namespace App\EventSubscriber;

use App\Service\MetricsService;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class MetricsSubscriber implements EventSubscriberInterface
{
    public function __construct(private readonly MetricsService $metrics) {}

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST  => ['onRequest',  9999],
            KernelEvents::RESPONSE => ['onResponse', -9999],
        ];
    }

    public function onRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }
        $event->getRequest()->attributes->set('_t0', hrtime(true));
    }

    public function onResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }
        $req = $event->getRequest();
        $t0  = $req->attributes->get('_t0');
        if ($t0 === null) {
            return;
        }

        $path = $req->getPathInfo();
        if ($path === '/metrics') {
            return;
        }

        $duration = (hrtime(true) - $t0) / 1e9;
        $this->metrics->record(
            $req->getMethod(),
            $this->normalizePath($path),
            $event->getResponse()->getStatusCode(),
            $duration
        );
    }

    private function normalizePath(string $path): string
    {
        $parts = explode('/', $path);
        foreach ($parts as &$seg) {
            if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $seg)) {
                $seg = ':id';
            }
        }
        return implode('/', $parts);
    }
}
