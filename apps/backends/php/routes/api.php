<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\ProductsController;
use App\Http\Controllers\ProductByIdController;
use App\Http\Controllers\OrdersController;
use App\Http\Controllers\OrderByIdController;
use App\Http\Controllers\RevenueReportController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);
Route::post('/checkout', CheckoutController::class);
Route::get('/metrics', MetricsController::class);
Route::get('/products', ProductsController::class);
Route::get('/products/{id}', ProductByIdController::class);
Route::get('/orders/recent', OrdersController::class);
Route::get('/orders/{id}', OrderByIdController::class);
Route::get('/reports/revenue', RevenueReportController::class);
