<?php

namespace App\Services;

class FraudService
{
    public function calculateScore(int $subtotalCents, int $itemCount): int
    {
        // Simple fraud scoring: base score + item multiplier
        return ($subtotalCents / 100) + ($itemCount * 10);
    }
}
