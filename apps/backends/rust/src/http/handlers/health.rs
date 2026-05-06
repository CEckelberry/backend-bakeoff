use axum::{Json, http::StatusCode, extract::State};
use serde_json::json;
use crate::http::router::AppState;

pub async fn health(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if sqlx::query("SELECT 1").execute(&state.pool).await.is_ok() {
        Ok(Json(json!({"status": "ok"})))
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, "DB unreachable".to_string()))
    }
}
