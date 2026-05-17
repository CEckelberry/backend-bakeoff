use axum::{Json, http::StatusCode, extract::{State, Path}};
use serde_json::{json, Value};
use crate::http::router::AppState;

pub async fn products(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let rows = sqlx::query(
        "SELECT id, sku, name, price_cents, stock FROM bakeoff_rust.products ORDER BY name"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let products: Vec<Value> = rows.iter().map(|r| {
        use sqlx::Row;
        json!({
            "id": r.get::<sqlx::types::Uuid, _>("id").to_string(),
            "sku": r.get::<String, _>("sku"),
            "name": r.get::<String, _>("name"),
            "price_cents": r.get::<i32, _>("price_cents"),
            "stock": r.get::<i32, _>("stock"),
        })
    }).collect();

    Ok(Json(json!({ "products": products })))
}

pub async fn product_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let uuid = sqlx::types::Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::NOT_FOUND, "not found".to_string()))?;

    let row = sqlx::query(
        "SELECT id, sku, name, price_cents, stock FROM bakeoff_rust.products WHERE id = $1"
    )
    .bind(uuid)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match row {
        None => Err((StatusCode::NOT_FOUND, "not found".to_string())),
        Some(r) => {
            use sqlx::Row;
            Ok(Json(json!({
                "id": r.get::<sqlx::types::Uuid, _>("id").to_string(),
                "sku": r.get::<String, _>("sku"),
                "name": r.get::<String, _>("name"),
                "price_cents": r.get::<i32, _>("price_cents"),
                "stock": r.get::<i32, _>("stock"),
            })))
        }
    }
}
