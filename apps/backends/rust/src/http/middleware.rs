use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;
use crate::observability::Metrics;
use std::sync::Arc;

pub async fn observability_middleware(
    metrics: Arc<Metrics>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path().to_string();

    // Don't record metrics about the /metrics scrape endpoint itself
    if path == "/metrics" {
        return next.run(request).await;
    }

    let start = Instant::now();
    let method = request.method().to_string();
    let normalized = normalize_path(&path);

    let response = next.run(request).await;

    let duration = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    metrics.http_requests_total
        .with_label_values(&[&method, &normalized, &status])
        .inc();
    metrics.http_request_duration_seconds
        .with_label_values(&[&method, &normalized])
        .observe(duration);

    response
}

// Replace UUID-shaped segments with :id to keep metric cardinality bounded
fn normalize_path(path: &str) -> String {
    path.split('/')
        .map(|seg| {
            if seg.len() == 36 && seg.chars().filter(|&c| c == '-').count() == 4 {
                ":id"
            } else {
                seg
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}
