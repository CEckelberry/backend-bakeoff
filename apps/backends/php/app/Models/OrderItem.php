<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $table = 'order_items';
    protected $connection = 'pgsql';
    protected $guarded = [];
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $casts = [
        'id' => 'string',
        'order_id' => 'string',
        'product_id' => 'string',
        'created_at' => 'datetime',
    ];
}
