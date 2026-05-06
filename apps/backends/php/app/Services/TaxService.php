<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class TaxService
{
    private $baseUrl;

    public function __construct()
    {
        $this->baseUrl = env('TAX_SERVICE_URL', 'http://tax-service:8087');
    }

    public function calculateTax(int $subtotalCents, string $state): array
    {
        try {
            $response = Http::timeout(2)->post(
                $this->baseUrl . '/tax',
                [
                    'subtotal_cents' => $subtotalCents,
                    'state' => $state,
                ]
            );

            if ($response->failed()) {
                throw new \Exception('Tax service returned ' . $response->status());
            }

            return $response->json();
        } catch (\Exception $e) {
            \Log::error('Tax service error: ' . $e->getMessage());
            throw new \Exception('Tax service error');
        }
    }
}
