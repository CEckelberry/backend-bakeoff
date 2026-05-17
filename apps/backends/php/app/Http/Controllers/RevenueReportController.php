<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RevenueReportController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = DB::select(
            "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents " .
            "FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' " .
            "GROUP BY DATE(created_at) ORDER BY date DESC"
        );

        $report = array_map(fn($r) => [
            'date' => $r->date,
            'order_count' => (int) $r->order_count,
            'revenue_cents' => (int) $r->revenue_cents,
        ], $rows);

        return response()->json(['report' => $report]);
    }
}
