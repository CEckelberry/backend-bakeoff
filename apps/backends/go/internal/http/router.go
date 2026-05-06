package http

import (
	"backend-bakeoff-go/internal/http/handlers"
	"backend-bakeoff-go/internal/store"
	"backend-bakeoff-go/internal/tax"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

func NewRouter(s *store.PostgresStore, t *tax.Client, runtime string) *chi.Mux {
	r := chi.NewRouter()

	r.Use(middleware.Recoverer)
	r.Use(RequestID)
	r.Use(func(next http.Handler) http.Handler {
		return Logger(runtime, next)
	})

	r.Get("/health", handlers.HandleHealth(s))
	r.Post("/checkout", handlers.HandleCheckout(s, t))
	r.Handle("/metrics", promhttp.Handler())

	return r
}
