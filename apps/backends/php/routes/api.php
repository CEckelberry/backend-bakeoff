<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\MetricsController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);
Route::post('/checkout', CheckoutController::class);
Route::get('/metrics', MetricsController::class);
