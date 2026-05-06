<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
            return response()->json(['status' => 'ok']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'DB unreachable'], 503);
        }
    }
}
