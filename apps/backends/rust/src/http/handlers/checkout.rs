use axum::{Json, http::StatusCode, extract::State};
use serde_json::json;
use crate::domain::checkout::{CheckoutRequest, process_checkout};
use crate::http::router::AppState;

pub async fn checkout(
    State(state): State<AppState>,
    Json(req): Json<CheckoutRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, String)> {
    match process_checkout(req, &state.pool, &state.tax_client).await {
        Ok(resp) => Ok((
            StatusCode::CREATED,
            Json(json!({
                "order_id": resp.order_id,
                "total_cents": resp.total_cents,
                "tax_cents": resp.tax_cents,
                "fraud_score": resp.fraud_score,
            })),
        )),
        Err(e) => {
            let msg = e.to_string();
            let status = if msg.contains("Invalid") {
                StatusCode::BAD_REQUEST
            } else if msg.contains("stock") || msg.contains("Cart must") {
                StatusCode::UNPROCESSABLE_ENTITY
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            Err((status, msg))
        }
    }
}
