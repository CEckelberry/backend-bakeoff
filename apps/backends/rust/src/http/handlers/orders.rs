use axum::{Json, http::StatusCode, extract::{State, Path}};
use serde_json::{json, Value};
use crate::http::router::AppState;

pub async fn recent_orders(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_rust.orders ORDER BY created_at DESC LIMIT 20"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let orders: Vec<Value> = rows.iter().map(|r| {
        use sqlx::Row;
        let created_at: chrono::DateTime<chrono::Utc> = r.get("created_at");
        json!({
            "id": r.get::<sqlx::types::Uuid, _>("id").to_string(),
            "customer_id": r.get::<sqlx::types::Uuid, _>("customer_id").to_string(),
            "total_cents": r.get::<i32, _>("total_cents"),
            "tax_cents": r.get::<i32, _>("tax_cents"),
            "created_at": created_at.to_rfc3339(),
        })
    }).collect();

    Ok(Json(json!({ "orders": orders })))
}

pub async fn order_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let uuid = sqlx::types::Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::NOT_FOUND, "not found".to_string()))?;

    let row = sqlx::query(
        "SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_rust.orders WHERE id = $1"
    )
    .bind(uuid)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match row {
        None => Err((StatusCode::NOT_FOUND, "not found".to_string())),
        Some(r) => {
            use sqlx::Row;
            let created_at: chrono::DateTime<chrono::Utc> = r.get("created_at");
            let order_id = r.get::<sqlx::types::Uuid, _>("id");

            let item_rows = sqlx::query(
                "SELECT product_id, quantity, price_cents FROM bakeoff_rust.order_items WHERE order_id = $1"
            )
            .bind(order_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let items: Vec<Value> = item_rows.iter().map(|ir| {
                json!({
                    "product_id": ir.get::<sqlx::types::Uuid, _>("product_id").to_string(),
                    "quantity": ir.get::<i32, _>("quantity"),
                    "price_cents": ir.get::<i32, _>("price_cents"),
                })
            }).collect();

            Ok(Json(json!({
                "id": order_id.to_string(),
                "customer_id": r.get::<sqlx::types::Uuid, _>("customer_id").to_string(),
                "total_cents": r.get::<i32, _>("total_cents"),
                "tax_cents": r.get::<i32, _>("tax_cents"),
                "created_at": created_at.to_rfc3339(),
                "items": items,
            })))
        }
    }
}

pub async fn revenue_report(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents \
         FROM bakeoff_rust.orders WHERE created_at >= NOW() - INTERVAL '30 days' \
         GROUP BY DATE(created_at) ORDER BY date DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let report: Vec<Value> = rows.iter().map(|r| {
        use sqlx::Row;
        let date: chrono::NaiveDate = r.get("date");
        json!({
            "date": date.to_string(),
            "order_count": r.get::<i64, _>("order_count"),
            "revenue_cents": r.get::<i64, _>("revenue_cents"),
        })
    }).collect();

    Ok(Json(json!({ "report": report })))
}
