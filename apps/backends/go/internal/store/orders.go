package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Product struct {
	ID    uuid.UUID
	Price int
	Stock int
}

type Order struct {
	ID         uuid.UUID
	CustomerID uuid.UUID
	TotalCents int
	TaxCents   int
}

type OrderItem struct {
	ProductID uuid.UUID
	Quantity  int
	Price     int
}

func (ps *PostgresStore) GetProduct(ctx context.Context, id uuid.UUID) (*Product, error) {
	var p Product
	err := ps.Pool.QueryRow(ctx, 
		"SELECT id, price_cents, stock FROM bakeoff_go.products WHERE id = $1", id).
		Scan(&p.ID, &p.Price, &p.Stock)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (ps *PostgresStore) InsertOrder(ctx context.Context, order Order, items []OrderItem) error {
	return ps.Pool.BeginFunc(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, 
			"INSERT INTO bakeoff_go.orders (id, customer_id, total_cents, tax_cents, created_at) VALUES ($1, $2, $3, $4, NOW())",
			order.ID, order.CustomerID, order.TotalCents, order.TaxCents)
		if err != nil {
			return err
		}

		for _, item := range items {
			_, err := tx.Exec(ctx, 
				"INSERT INTO bakeoff_go.order_items (id, order_id, product_id, quantity, price_cents) VALUES ($1, $2, $3, $4, $5)",
				uuid.New(), order.ID, item.ProductID, item.Quantity, item.Price)
			if err != nil {
				return err
			}

			_, err = tx.Exec(ctx, 
				"UPDATE bakeoff_go.products SET stock = stock - $1 WHERE id = $2 AND stock >= $1", 
				item.Quantity, item.ProductID)
			if err != nil {
				return fmt.Errorf("insufficient stock for product %s", item.ProductID)
			}
		}
		return nil
	})
}
