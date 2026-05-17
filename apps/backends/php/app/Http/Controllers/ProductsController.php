<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProductsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = DB::select('SELECT id, sku, name, price_cents, stock FROM products ORDER BY name');

        $products = array_map(fn($r) => [
            'id' => $r->id,
            'sku' => $r->sku,
            'name' => $r->name,
            'price_cents' => $r->price_cents,
            'stock' => $r->stock,
        ], $rows);

        return response()->json(['products' => $products]);
    }
}
