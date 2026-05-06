use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;
use tracing::info;
use crate::observability::Metrics;
use std::sync::Arc;

pub async fn observability_middleware(
    metrics: Arc<Metrics>,
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    metrics.http_requests_total
        .with_label_values(&[&method, &path, &status])
        .inc();
    metrics.http_request_duration_seconds
        .with_label_values(&[&method, &path])
        .observe(duration);

    info!(
        method = %method,
        path = %path,
        status = %status,
        duration_ms = duration * 1000.0,
        "request processed"
    );

    response
}
