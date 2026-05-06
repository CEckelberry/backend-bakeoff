pub fn compute_fraud_score(total_cents: i32, item_count: usize) -> i32 {
    (total_cents / 100) + (item_count as i32 * 10)
}
