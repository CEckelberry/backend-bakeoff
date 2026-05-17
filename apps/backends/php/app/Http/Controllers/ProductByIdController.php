<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductByIdController extends Controller
{
    public function __invoke(string $id): JsonResponse
    {
        $rows = DB::select('SELECT id, sku, name, price_cents, stock FROM products WHERE id = ?', [$id]);

        if (empty($rows)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $r = $rows[0];

        return response()->json([
            'id' => $r->id,
            'sku' => $r->sku,
            'name' => $r->name,
            'price_cents' => $r->price_cents,
            'stock' => $r->stock,
        ]);
    }
}
