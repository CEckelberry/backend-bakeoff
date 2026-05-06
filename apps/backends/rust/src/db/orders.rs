use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub struct Product {
    pub id: Uuid,
    pub price: i32,
    pub stock: i32,
}

pub struct Order {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub total_cents: i32,
    pub tax_cents: i32,
}

pub struct OrderItem {
    pub product_id: Uuid,
    pub quantity: i32,
    pub price: i32,
}

pub async fn get_product(pool: &PgPool, id: Uuid) -> Result<Product, sqlx::Error> {
    sqlx::query_as::<_, (Uuid, i32, i32)>(
        "SELECT id, price_cents, stock FROM bakeoff_rust.products WHERE id = $1"
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map(|(id, price, stock)| Product { id, price, stock })
}

pub async fn insert_order(
    pool: &PgPool,
    order: Order,
    items: Vec<OrderItem>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;
    
    sqlx::query(
        "INSERT INTO bakeoff_rust.orders (id, customer_id, total_cents, tax_cents, created_at) VALUES ($1, $2, $3, $4, NOW())"
    )
    .bind(order.id)
    .bind(order.customer_id)
    .bind(order.total_cents)
    .bind(order.tax_cents)
    .execute(&mut *tx)
    .await?;
    
    for item in items {
        sqlx::query(
            "INSERT INTO bakeoff_rust.order_items (id, order_id, product_id, quantity, price_cents, created_at) VALUES ($1, $2, $3, $4, $5, NOW())"
        )
        .bind(Uuid::new_v4())
        .bind(order.id)
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(item.price)
        .execute(&mut *tx)
        .await?;
        
        let result = sqlx::query(
            "UPDATE bakeoff_rust.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1"
        )
        .bind(item.quantity)
        .bind(item.product_id)
        .execute(&mut *tx)
        .await?;
        
        if result.rows_affected() == 0 {
            return Err("Insufficient stock".into());
        }
    }
    
    tx.commit().await?;
    Ok(())
}
