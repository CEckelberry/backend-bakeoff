<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class OrdersController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = DB::select(
            'SELECT id, customer_id, total_cents, tax_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 20'
        );

        $orders = array_map(fn($r) => [
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'total_cents' => $r->total_cents,
            'tax_cents' => $r->tax_cents,
            'created_at' => $r->created_at,
        ], $rows);

        return response()->json(['orders' => $orders]);
    }
}
