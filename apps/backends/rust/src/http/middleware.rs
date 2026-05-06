use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;
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

    // Only record metrics, skip logging on hot path
    metrics.http_requests_total
        .with_label_values(&[&method, &path, &status])
        .inc();
    metrics.http_request_duration_seconds
        .with_label_values(&[&method, &path])
        .observe(duration);

    response
}
