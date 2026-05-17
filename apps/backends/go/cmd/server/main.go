package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"backend-bakeoff-go/internal/config"
	"backend-bakeoff-go/internal/observability"
	"backend-bakeoff-go/internal/store"
	"backend-bakeoff-go/internal/tax"
)

func main() {
	// 1. Config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// Structured logging setup
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 2. Store
	dbStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer dbStore.Close()

	// 3. Tax Client
	taxClient := tax.NewClient(cfg.TaxServiceURL)

	// 4. Create Fiber app
	app := fiber.New(fiber.Config{
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	})

	// 5. Middleware for metrics and logging
	app.Use(func(c *fiber.Ctx) error {
		start := time.Now()
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		err := c.Next()

		duration := time.Since(start)
		method := c.Method()
		path := c.Path()
		status := c.Response().StatusCode()

		// Record metrics
		observability.HTTPRequestsTotal.WithLabelValues(method, path, strconv.Itoa(status)).Inc()
		observability.HTTPRequestDurationSeconds.WithLabelValues(method, path).Observe(duration.Seconds())

		// Log
		slog.Info("request processed",
			"request_id", requestID,
			"method", method,
			"path", path,
			"status", status,
			"duration_ms", int(duration.Milliseconds()),
			"runtime", "go",
		)

		return err
	})

	// 6. Routes
	app.Get("/health", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		if err := dbStore.Pool.Ping(ctx); err != nil {
			return c.Status(503).JSON(map[string]string{"error": "DB unreachable"})
		}
		return c.JSON(map[string]string{"status": "ok"})
	})

	app.Post("/checkout", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var req struct {
			CustomerID string `json:"customer_id"`
			Items      []struct {
				ProductID string `json:"product_id"`
				Quantity  int    `json:"quantity"`
			} `json:"items"`
			State string `json:"state"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(map[string]string{"error": "Invalid request"})
		}

		// Validate customer ID
		if _, err := uuid.Parse(req.CustomerID); err != nil {
			return c.Status(400).JSON(map[string]string{"error": "Invalid customer ID"})
		}

		// Validate items
		if len(req.Items) == 0 || len(req.Items) > 8 {
			return c.Status(422).JSON(map[string]string{"error": "Cart must have 1-8 items"})
		}

		subtotal := 0
		for _, item := range req.Items {
			if _, err := uuid.Parse(item.ProductID); err != nil {
				return c.Status(400).JSON(map[string]string{"error": "Invalid product ID"})
			}

			row := dbStore.Pool.QueryRow(ctx,
				"SELECT id, price_cents, stock FROM bakeoff_go.products WHERE id = $1",
				item.ProductID,
			)
			var id string
			var priceCents, stock int
			if err := row.Scan(&id, &priceCents, &stock); err != nil {
				if err == pgx.ErrNoRows {
					return c.Status(404).JSON(map[string]string{"error": "Product not found"})
				}
				return c.Status(500).JSON(map[string]string{"error": "Database error"})
			}

			if stock < item.Quantity {
				return c.Status(422).JSON(map[string]string{"error": "Insufficient stock"})
			}

			subtotal += priceCents * item.Quantity
		}

		// Calculate tax via tax service
		taxResp, err := taxClient.CalculateTax(ctx, tax.TaxRequest{
			SubtotalCents: subtotal,
			State:         req.State,
		})
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": "Tax service error"})
		}

		fraudScore := subtotal/100 + len(req.Items)*10
		orderID := uuid.New().String()
		total := subtotal + taxResp.TaxCents

		// Insert order
		if _, err := dbStore.Pool.Exec(ctx,
			"INSERT INTO bakeoff_go.orders (id, customer_id, total_cents, tax_cents, created_at) VALUES ($1, $2, $3, $4, NOW())",
			orderID, req.CustomerID, total, taxResp.TaxCents,
		); err != nil {
			return c.Status(500).JSON(map[string]string{"error": "Failed to create order"})
		}

		return c.Status(201).JSON(map[string]interface{}{
			"order_id":    orderID,
			"total_cents": total,
			"tax_cents":   taxResp.TaxCents,
			"fraud_score": fraudScore,
		})
	})

	// Prometheus metrics endpoint
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	app.Get("/products", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		rows, err := dbStore.Pool.Query(ctx,
			"SELECT id, sku, name, price_cents, stock FROM bakeoff_go.products ORDER BY name")
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		defer rows.Close()
		products := []map[string]interface{}{}
		for rows.Next() {
			var id, sku, name string
			var priceCents, stock int
			if err := rows.Scan(&id, &sku, &name, &priceCents, &stock); err != nil {
				return c.Status(500).JSON(map[string]string{"error": err.Error()})
			}
			products = append(products, map[string]interface{}{
				"id": id, "sku": sku, "name": name, "price_cents": priceCents, "stock": stock,
			})
		}
		return c.JSON(map[string]interface{}{"products": products})
	})

	app.Get("/products/:id", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		id := c.Params("id")
		var pid, sku, name string
		var priceCents, stock int
		err := dbStore.Pool.QueryRow(ctx,
			"SELECT id, sku, name, price_cents, stock FROM bakeoff_go.products WHERE id = $1", id).
			Scan(&pid, &sku, &name, &priceCents, &stock)
		if err == pgx.ErrNoRows {
			return c.Status(404).JSON(map[string]string{"error": "not found"})
		}
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		return c.JSON(map[string]interface{}{
			"id": pid, "sku": sku, "name": name, "price_cents": priceCents, "stock": stock,
		})
	})

	app.Get("/orders/recent", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		rows, err := dbStore.Pool.Query(ctx,
			"SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_go.orders ORDER BY created_at DESC LIMIT 20")
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		defer rows.Close()
		orders := []map[string]interface{}{}
		for rows.Next() {
			var id, customerID string
			var totalCents, taxCents int
			var createdAt time.Time
			if err := rows.Scan(&id, &customerID, &totalCents, &taxCents, &createdAt); err != nil {
				return c.Status(500).JSON(map[string]string{"error": err.Error()})
			}
			orders = append(orders, map[string]interface{}{
				"id": id, "customer_id": customerID, "total_cents": totalCents,
				"tax_cents": taxCents, "created_at": createdAt,
			})
		}
		return c.JSON(map[string]interface{}{"orders": orders})
	})

	app.Get("/orders/:id", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		id := c.Params("id")
		var oid, customerID string
		var totalCents, taxCents int
		var createdAt time.Time
		err := dbStore.Pool.QueryRow(ctx,
			"SELECT id, customer_id, total_cents, tax_cents, created_at FROM bakeoff_go.orders WHERE id = $1", id).
			Scan(&oid, &customerID, &totalCents, &taxCents, &createdAt)
		if err == pgx.ErrNoRows {
			return c.Status(404).JSON(map[string]string{"error": "not found"})
		}
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		itemRows, err := dbStore.Pool.Query(ctx,
			"SELECT product_id, quantity, price_cents FROM bakeoff_go.order_items WHERE order_id = $1", id)
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		defer itemRows.Close()
		items := []map[string]interface{}{}
		for itemRows.Next() {
			var productID string
			var quantity, priceCents int
			if err := itemRows.Scan(&productID, &quantity, &priceCents); err != nil {
				return c.Status(500).JSON(map[string]string{"error": err.Error()})
			}
			items = append(items, map[string]interface{}{
				"product_id": productID, "quantity": quantity, "price_cents": priceCents,
			})
		}
		return c.JSON(map[string]interface{}{
			"id": oid, "customer_id": customerID, "total_cents": totalCents,
			"tax_cents": taxCents, "created_at": createdAt, "items": items,
		})
	})

	app.Get("/reports/revenue", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		rows, err := dbStore.Pool.Query(ctx,
			"SELECT DATE(created_at)::text as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents FROM bakeoff_go.orders WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date DESC")
		if err != nil {
			return c.Status(500).JSON(map[string]string{"error": err.Error()})
		}
		defer rows.Close()
		report := []map[string]interface{}{}
		for rows.Next() {
			var date string
			var orderCount int64
			var revenueCents int64
			if err := rows.Scan(&date, &orderCount, &revenueCents); err != nil {
				return c.Status(500).JSON(map[string]string{"error": err.Error()})
			}
			report = append(report, map[string]interface{}{
				"date": date, "order_count": orderCount, "revenue_cents": revenueCents,
			})
		}
		return c.JSON(map[string]interface{}{"report": report})
	})

	slog.Info("starting server", "addr", cfg.ListenAddr, "runtime", cfg.RuntimeName)

	// Start server in goroutine
	go func() {
		if err := app.Listen(cfg.ListenAddr); err != nil {
			slog.Error("server failed", "error", err)
		}
	}()

	// Graceful Shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	slog.Info("shutting down server")
	app.Shutdown()
}
