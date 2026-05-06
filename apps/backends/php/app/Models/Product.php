<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $table = 'products';
    protected $connection = 'pgsql';
    protected $guarded = [];
    public $timestamps = false;

    protected $casts = [
        'id' => 'string',
    ];
}
