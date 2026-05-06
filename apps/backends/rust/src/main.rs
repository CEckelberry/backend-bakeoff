mod config;
mod db;
mod http;
mod domain;
mod clients;
mod observability;

use std::net::SocketAddr;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cfg = config::Config::load()?;
    
    // Observability setup
    observability::init_tracing(&cfg);
    let metrics = observability::init_metrics();
    
    // Infrastructure setup
    let pool = db::init_pool(&cfg.database_url).await?;
    let tax_client = clients::tax::TaxClient::new(cfg.tax_service_url);
    
    // Router setup
    let app = http::router::create_router(pool, tax_client, metrics);
    
    let addr: SocketAddr = cfg.listen_addr.parse()?;
    let listener = TcpListener::bind(addr).await?;
    
    tracing::info!("Rust backend listening on {}", addr);
    axum::serve(listener, app).await?;
    
    Ok(())
}
