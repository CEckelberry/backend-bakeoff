use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub tax_service_url: String,
    pub log_level: String,
    pub runtime_name: String,
    pub listen_addr: String,
    pub otel_endpoint: String,
}

impl Config {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Config {
            database_url: env::var("DATABASE_URL")?,
            tax_service_url: env::var("TAX_SERVICE_URL")?,
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            runtime_name: env::var("RUNTIME_NAME").unwrap_or_else(|_| "rust".to_string()),
            listen_addr: env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            otel_endpoint: env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
                .unwrap_or_else(|_| "http://otel-collector:4317".to_string()),
        })
    }
}
