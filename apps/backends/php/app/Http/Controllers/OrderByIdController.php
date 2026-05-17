<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class OrderByIdController extends Controller
{
    public function __invoke(string $id): JsonResponse
    {
        $rows = DB::select(
            'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders WHERE id = ?',
            [$id]
        );

        if (empty($rows)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $r = $rows[0];

        $itemRows = DB::select(
            'SELECT product_id, quantity, price_cents FROM order_items WHERE order_id = ?',
            [$id]
        );

        $items = array_map(fn($ir) => [
            'product_id' => $ir->product_id,
            'quantity' => $ir->quantity,
            'price_cents' => $ir->price_cents,
        ], $itemRows);

        return response()->json([
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'total_cents' => $r->total_cents,
            'tax_cents' => $r->tax_cents,
            'created_at' => $r->created_at,
            'items' => $items,
        ]);
    }
}
