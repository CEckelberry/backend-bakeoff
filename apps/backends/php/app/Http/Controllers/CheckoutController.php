<?php

namespace App\Http\Controllers;

use App\Services\CheckoutService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function __construct(private CheckoutService $checkoutService)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        try {
            // Validate input
            $validated = $request->validate([
                'customer_id' => 'required|uuid',
                'items' => 'required|array|min:1|max:8',
                'items.*.product_id' => 'required|uuid',
                'items.*.quantity' => 'required|integer|min:1',
                'state' => 'required|string|max:2',
            ]);

            // Process checkout
            $result = $this->checkoutService->processCheckout(
                $validated['customer_id'],
                $validated['items'],
                $validated['state']
            );

            return response()->json($result, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => 'Invalid request'], 400);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 500;
            $message = $e->getMessage();

            if ($code == 422) {
                return response()->json(['error' => $message], 422);
            } elseif ($code == 404) {
                return response()->json(['error' => $message], 404);
            }

            return response()->json(['error' => $message], $code ?: 500);
        }
    }
}
