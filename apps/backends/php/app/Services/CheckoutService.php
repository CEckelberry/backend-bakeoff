<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CheckoutService
{
    private $taxService;
    private $fraudService;

    public function __construct(TaxService $taxService, FraudService $fraudService)
    {
        $this->taxService = $taxService;
        $this->fraudService = $fraudService;
    }

    public function processCheckout(string $customerId, array $items, string $state): array
    {
        // Validate items
        if (empty($items) || count($items) > 8) {
            throw new \Exception('Cart must have 1-8 items', 422);
        }

        return DB::transaction(function () use ($customerId, $items, $state) {
            $subtotal = 0;
            $orderItems = [];

            // Validate stock and calculate subtotal
            foreach ($items as $item) {
                $product = Product::whereRaw('id::text = ?', [$item['product_id']])->first();
                
                if (!$product) {
                    throw new \Exception('Product not found', 404);
                }

                if ($product->stock < $item['quantity']) {
                    throw new \Exception('Insufficient stock', 422);
                }

                $subtotal += $product->price_cents * $item['quantity'];
                $orderItems[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price_cents' => $product->price_cents,
                ];
            }

            // Calculate tax
            $taxResp = $this->taxService->calculateTax($subtotal, $state);
            $taxCents = $taxResp['tax_cents'] ?? 0;

            // Calculate fraud score
            $fraudScore = $this->fraudService->calculateScore($subtotal, count($items));

            // Create order
            $orderId = Str::uuid()->toString();
            $total = $subtotal + $taxCents;

            Order::create([
                'id' => $orderId,
                'customer_id' => $customerId,
                'total_cents' => $total,
                'tax_cents' => $taxCents,
                'created_at' => now(),
            ]);

            // Create order items
            foreach ($orderItems as $item) {
                OrderItem::create([
                    'id' => Str::uuid()->toString(),
                    'order_id' => $orderId,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price_cents' => $item['price_cents'],
                    'created_at' => now(),
                ]);
            }

            return [
                'order_id' => $orderId,
                'total_cents' => $total,
                'tax_cents' => $taxCents,
                'fraud_score' => $fraudScore,
            ];
        }, attempts: 3, timeout: 5);
    }
}
