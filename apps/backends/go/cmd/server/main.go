package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend-bakeoff-go/internal/config"
	httphandler "backend-bakeoff-go/internal/http"
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

	// 2. Observability - DISABLED to reduce latency overhead
	// The gRPC connection to OTEL collector was adding 2-3ms per request
	// tp, err := observability.InitTracing(ctx, cfg.RuntimeName)
	// if err != nil {
	//	slog.Error("failed to init tracing", "error", err)
	// } else {
	//	defer func() {
	//		if err := tp.Shutdown(context.Background()); err != nil {
	//			slog.Error("tracing shutdown error", "error", err)
	//		}
	//	}()
	// }

	// 3. Store
	dbStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer dbStore.Close()

	// 4. Tax Client
	taxClient := tax.NewClient(cfg.TaxServiceURL)

	// 5. Router
	router := httphandler.NewRouter(dbStore, taxClient, cfg.RuntimeName)

	server := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      router,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful Shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		slog.Info("shutting down server...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("server forced to shutdown", "error", err)
		}
	}()

	slog.Info("starting server", "addr", cfg.ListenAddr, "runtime", cfg.RuntimeName)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
