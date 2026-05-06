use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize)]
struct TaxRequest {
    subtotal_cents: i32,
    state: String,
}

#[derive(Deserialize)]
pub struct TaxResponse {
    pub tax_cents: i32,
}

#[derive(Clone)]
pub struct TaxClient {
    base_url: String,
    client: Client,
}

impl TaxClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: Client::builder().timeout(Duration::from_secs(2)).build().unwrap(),
        }
    }
    
    pub async fn calculate_tax(&self, subtotal: i32, state: &str) -> Result<TaxResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/tax", self.base_url);
        let resp = self.client
            .post(&url)
            .json(&TaxRequest { subtotal_cents: subtotal, state: state.to_string() })
            .send()
            .await?
            .json::<TaxResponse>()
            .await?;
        Ok(resp)
    }
}
