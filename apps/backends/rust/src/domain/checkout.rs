use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use crate::db::orders;
use crate::clients::tax::TaxClient;
use crate::domain::fraud::compute_fraud_score;

#[derive(Deserialize)]
pub struct CheckoutRequest {
    pub customer_id: String,
    pub items: Vec<CartItem>,
    pub state: String,
}

#[derive(Deserialize)]
pub struct CartItem {
    pub product_id: String,
    pub quantity: i32,
}

#[derive(Serialize)]
pub struct CheckoutResponse {
    pub order_id: String,
    pub total_cents: i32,
    pub tax_cents: i32,
    pub fraud_score: i32,
}

pub async fn process_checkout(
    req: CheckoutRequest,
    pool: &PgPool,
    tax_client: &TaxClient,
) -> Result<CheckoutResponse, Box<dyn std::error::Error>> {
    if req.items.is_empty() || req.items.len() > 8 {
        return Err("Cart must have 1-8 items".into());
    }
    
    let customer_id = Uuid::parse_str(&req.customer_id).map_err(|_| "Invalid customer ID")?;
    let mut subtotal = 0i32;
    let mut order_items = Vec::new();
    
    for item_req in req.items {
        let product_id = Uuid::parse_str(&item_req.product_id).map_err(|_| "Invalid product ID")?;
        let product = orders::get_product(pool, product_id).await.map_err(|_| "Product not found")?;
        
        if product.stock < item_req.quantity {
            return Err("Insufficient stock".into());
        }
        
        subtotal += product.price * item_req.quantity;
        order_items.push(orders::OrderItem {
            product_id,
            quantity: item_req.quantity,
            price: product.price,
        });
    }
    
    let tax_resp = tax_client.calculate_tax(subtotal, &req.state).await?;
    let fraud_score = compute_fraud_score(subtotal, order_items.len());
    let order_id = Uuid::new_v4();
    let total = subtotal + tax_resp.tax_cents;
    
    orders::insert_order(
        pool,
        orders::Order { id: order_id, customer_id, total_cents: total, tax_cents: tax_resp.tax_cents },
        order_items,
    ).await?;
    
    Ok(CheckoutResponse {
        order_id: order_id.to_string(),
        total_cents: total,
        tax_cents: tax_resp.tax_cents,
        fraud_score,
    })
}
