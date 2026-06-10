<?php

namespace App\Service;

class DbService
{
    private \PDO $pdo;

    public function __construct()
    {
        // Options in DSN sets search_path at connect time — no extra round trip needed.
        // PDO::ATTR_PERSISTENT reuses the connection across Symfony kernel reboots
        // (each FrankenPHP worker shares a connection pool keyed by DSN).
        $schema = getenv('DB_SCHEMA') ?: 'bakeoff_php';
        $dsn = sprintf(
            "pgsql:host=%s;port=%s;dbname=%s;options='--search_path=%s'",
            getenv('DB_HOST') ?: 'localhost',
            getenv('DB_PORT') ?: '5432',
            getenv('DB_DATABASE') ?: 'bakeoff',
            $schema
        );
        $this->pdo = new \PDO(
            $dsn,
            getenv('DB_USERNAME') ?: 'postgres',
            getenv('DB_PASSWORD') ?: 'password',
            [
                \PDO::ATTR_ERRMODE    => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_PERSISTENT => true,
            ]
        );
    }

    public function pdo(): \PDO
    {
        return $this->pdo;
    }
}
