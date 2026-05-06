<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),

    'connections' => [
        'pgsql' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', 'db'),
            'port' => env('DB_PORT', 5432),
            'database' => env('DB_DATABASE', 'bakeoff_php'),
            'username' => env('DB_USERNAME', 'postgres'),
            'password' => env('DB_PASSWORD', 'postgres'),
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => env('DB_SCHEMA', 'public'),
            'sslmode' => 'disable',
            'options' => [
                'connect_timeout' => 5,
                'application_name' => 'backend-bakeoff-php',
            ],
        ],
    ],
];
