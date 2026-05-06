use axum::{routing::{get, post}, Router, extract::{DefaultBodyLimit, State}};
use sqlx::PgPool;
use tower::ServiceBuilder;
use std::sync::Arc;
use prometheus::{Encoder, TextEncoder};

use crate::http::handlers::{health, checkout};
use crate::http::middleware::observability_middleware;
use crate::clients::tax::TaxClient;
use crate::observability::Metrics;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub tax_client: TaxClient,
    pub metrics: Arc<Metrics>,
}

pub fn create_router(pool: PgPool, tax_client: TaxClient, metrics: Arc<Metrics>) -> Router {
    let state = AppState {
        pool: pool.clone(),
        tax_client,
        metrics: metrics.clone(),
    };
    
    // Checkout with observability middleware (hot path)
    let checkout_router = Router::new()
        .route("/checkout", post(checkout::checkout))
        .with_state(state.clone())
        .layer(
            ServiceBuilder::new()
                .layer(axum::middleware::from_fn(
                    move |req, next| observability_middleware(metrics.clone(), req, next),
                ))
        );

    // Health and metrics without middleware (low priority endpoints)
    let other_routes = Router::new()
        .route("/health", get(health::health))
        .route("/metrics", get(metrics_handler))
        .with_state(state)
        .layer(DefaultBodyLimit::max(1024 * 1024));

    // Merge routers
    checkout_router.merge(other_routes)
}

async fn metrics_handler() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap_or(());
    String::from_utf8(buffer).unwrap_or_default()
}
