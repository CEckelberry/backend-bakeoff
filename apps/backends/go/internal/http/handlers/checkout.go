package handlers

import (
	"encoding/json"
	"net/http"

	"backend-bakeoff-go/internal/domain"
	"backend-bakeoff-go/internal/observability"
	"backend-bakeoff-go/internal/store"
	"backend-bakeoff-go/internal/tax"
	"time"
)

func HandleCheckout(s *store.PostgresStore, t *tax.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		var req domain.CheckoutRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		res, err := domain.ProcessCheckout(r.Context(), req, s, t)
		status := http.StatusCreated
		if err != nil {
			// Simple error mapping
			status = http.StatusInternalServerError
			if err.Error() == "invalid customer id" || err.Error() == "invalid product id" {
				status = http.StatusBadRequest
			} else if err.Error() == "cart must have between 1 and 8 items" {
				status = http.StatusBadRequest
			} else if len(err.Error()) > 0 && (err.Error()[:12] == "insufficient") {
				status = http.StatusUnprocessableEntity
			}
			
			observability.CheckoutRequests.WithLabelValues("error").Inc()
			http.Error(w, err.Error(), status)
			return
		}

		observability.CheckoutRequests.WithLabelValues("success").Inc()
		observability.CheckoutLatency.WithLabelValues("success").Observe(time.Since(start).Seconds())
		
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(res)
	}
}
