<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $table = 'orders';
    protected $connection = 'pgsql';
    protected $guarded = [];
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $casts = [
        'id' => 'string',
        'customer_id' => 'string',
        'created_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class, 'order_id', 'id');
    }
}
