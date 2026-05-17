package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"backend-bakeoff-go/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type productRow struct {
	ID         string `json:"id"`
	SKU        string `json:"sku"`
	Name       string `json:"name"`
	PriceCents int    `json:"price_cents"`
	Stock      int    `json:"stock"`
}

type orderRow struct {
	ID         string    `json:"id"`
	CustomerID string    `json:"customer_id"`
	TotalCents int       `json:"total_cents"`
	TaxCents   int       `json:"tax_cents"`
	CreatedAt  time.Time `json:"created_at"`
}

type orderItemRow struct {
	ProductID  string `json:"product_id"`
	Quantity   int    `json:"quantity"`
	PriceCents int    `json:"price_cents"`
}

type orderWithItems struct {
	ID         string         `json:"id"`
	CustomerID string         `json:"customer_id"`
	TotalCents int            `json:"total_cents"`
	TaxCents   int            `json:"tax_cents"`
	CreatedAt  time.Time      `json:"created_at"`
	Items      []orderItemRow `json:"items"`
}

type revenueRow struct {
	Date         string `json:"date"`
	OrderCount   int    `json:"order_count"`
	RevenueCents int64  `json:"revenue_cents"`
}

func HandleProducts(s *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := s.Pool.Query(r.Context(),
			"SELECT id, sku, name, price_cents, stock FROM bakeoff_go.products ORDER BY name")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		products := []productRow{}
		for rows.Next() {
			var p productRow
			if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.PriceCents, &p.Stock); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			products = append(products, p)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"products": products})
	}
}

func HandleOrdersRecent(s *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := s.Pool.Query(r.Context(),
			"SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_go.orders ORDER BY created_at DESC LIMIT 20")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		orders := []orderRow{}
		for rows.Next() {
			var o orderRow
			if err := rows.Scan(&o.ID, &o.CustomerID, &o.TotalCents, &o.TaxCents, &o.CreatedAt); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			orders = append(orders, o)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"orders": orders})
	}
}

func HandleProductByID(s *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var p productRow
		err := s.Pool.QueryRow(r.Context(),
			"SELECT id, sku, name, price_cents, stock FROM bakeoff_go.products WHERE id = $1", id).
			Scan(&p.ID, &p.SKU, &p.Name, &p.PriceCents, &p.Stock)
		if err == pgx.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
	}
}

func HandleOrderByID(s *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var o orderWithItems
		err := s.Pool.QueryRow(r.Context(),
			"SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_go.orders WHERE id = $1", id).
			Scan(&o.ID, &o.CustomerID, &o.TotalCents, &o.TaxCents, &o.CreatedAt)
		if err == pgx.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		rows, err := s.Pool.Query(r.Context(),
			"SELECT product_id, quantity, price_cents FROM bakeoff_go.order_items WHERE order_id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		o.Items = []orderItemRow{}
		for rows.Next() {
			var i orderItemRow
			if err := rows.Scan(&i.ProductID, &i.Quantity, &i.PriceCents); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			o.Items = append(o.Items, i)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(o)
	}
}

func HandleRevenueReport(s *store.PostgresStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := s.Pool.Query(r.Context(),
			"SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents FROM bakeoff_go.orders WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date DESC")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		report := []revenueRow{}
		for rows.Next() {
			var rv revenueRow
			if err := rows.Scan(&rv.Date, &rv.OrderCount, &rv.RevenueCents); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			report = append(report, rv)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"report": report})
	}
}
