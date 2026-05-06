def compute_fraud_score(total_cents: int, item_count: int) -> int:
    return total_cents // 100 + item_count * 10
