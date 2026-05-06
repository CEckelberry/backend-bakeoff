use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use prometheus::{Registry, Opts, CounterVec, HistogramVec};
use std::sync::Arc;

pub struct Metrics {
    pub http_requests_total: CounterVec,
    pub http_request_duration_seconds: HistogramVec,
}

impl Metrics {
    pub fn new(registry: &Registry) -> Self {
        let http_requests_total = CounterVec::new(
            Opts::new("http_requests_total", "Total HTTP requests"),
            &["method", "endpoint", "status"],
        ).unwrap();

        let http_request_duration_seconds = HistogramVec::new(
            prometheus::HistogramOpts::new("http_request_duration_seconds", "HTTP request duration"),
            &["method", "endpoint"],
        ).unwrap();

        registry.register(Box::new(http_requests_total.clone())).unwrap();
        registry.register(Box::new(http_request_duration_seconds.clone())).unwrap();

        Self { http_requests_total, http_request_duration_seconds }
    }
}

pub fn init_tracing(config: &crate::config::Config) {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(&config.log_level))
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

pub fn init_metrics() -> Arc<Metrics> {
    let registry = Registry::new();
    Arc::new(Metrics::new(&registry))
}
