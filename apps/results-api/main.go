package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

// ---- config ----------------------------------------------------------------

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ---- rate limiter (per-IP, token bucket) -----------------------------------

type perIPLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipState
	r        rate.Limit
	burst    int
}

type ipState struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

func newPerIPLimiter(r rate.Limit, burst int) *perIPLimiter {
	l := &perIPLimiter{limiters: make(map[string]*ipState), r: r, burst: burst}
	go func() {
		t := time.NewTicker(15 * time.Minute)
		defer t.Stop()
		for now := range t.C {
			l.mu.Lock()
			for ip, st := range l.limiters {
				if now.Sub(st.lastSeen) > 6*time.Hour {
					delete(l.limiters, ip)
				}
			}
			l.mu.Unlock()
		}
	}()
	return l
}

func (l *perIPLimiter) allow(r *http.Request) bool {
	ip := clientIP(r)
	l.mu.Lock()
	defer l.mu.Unlock()
	st, ok := l.limiters[ip]
	if !ok {
		st = &ipState{lim: rate.NewLimiter(l.r, l.burst)}
		l.limiters[ip] = st
	}
	st.lastSeen = time.Now()
	return st.lim.Allow()
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := range xff {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---- helpers ---------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ---- handlers --------------------------------------------------------------

type BenchmarkRun struct {
	ID      string          `json:"id"`
	RunType string          `json:"run_type"`
	Label   *string         `json:"label"`
	RanAt   time.Time       `json:"ran_at"`
	Results json.RawMessage `json:"results"`
}

func handleHealth(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "db unreachable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func handleGetResults(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		rows, err := pool.Query(ctx, `
			SELECT id, run_type, label, ran_at, results
			FROM public.benchmark_runs
			ORDER BY
				CASE WHEN run_type = 'baseline' THEN 0 ELSE 1 END,
				ran_at DESC
			LIMIT 50
		`)
		if err != nil {
			slog.Error("query benchmark runs", "err", err)
			writeErr(w, http.StatusInternalServerError, "could not load results")
			return
		}
		defer rows.Close()

		runs := make([]BenchmarkRun, 0)
		for rows.Next() {
			var run BenchmarkRun
			var raw []byte
			if err := rows.Scan(&run.ID, &run.RunType, &run.Label, &run.RanAt, &raw); err != nil {
				slog.Error("scan benchmark run", "err", err)
				writeErr(w, http.StatusInternalServerError, "scan error")
				return
			}
			run.Results = json.RawMessage(raw)
			runs = append(runs, run)
		}
		if err := rows.Err(); err != nil {
			writeErr(w, http.StatusInternalServerError, "iterate error")
			return
		}

		w.Header().Set("Cache-Control", "public, max-age=30")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
	}
}

func handlePostResults(pool *pgxpool.Pool, rl *perIPLimiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")

		if !rl.allow(r) {
			w.Header().Set("Retry-After", "3600")
			writeErr(w, http.StatusTooManyRequests, "rate limit: max 2 submissions per hour per IP")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 512<<10)

		var req struct {
			Label   string          `json:"label"`
			Results json.RawMessage `json:"results"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if len(req.Results) == 0 || !json.Valid(req.Results) {
			writeErr(w, http.StatusBadRequest, "results field is required and must be valid JSON")
			return
		}
		if len(req.Label) > 120 {
			writeErr(w, http.StatusBadRequest, "label too long (max 120 chars)")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Cap user runs at 100 to avoid unbounded growth.
		_, _ = pool.Exec(ctx, `
			DELETE FROM public.benchmark_runs
			WHERE run_type = 'user'
			  AND id IN (
				SELECT id FROM public.benchmark_runs
				WHERE run_type = 'user'
				ORDER BY ran_at DESC
				OFFSET 99
			  )
		`)

		var label *string
		if req.Label != "" {
			label = &req.Label
		}

		var id string
		err := pool.QueryRow(ctx, `
			INSERT INTO public.benchmark_runs (run_type, label, results)
			VALUES ('user', $1, $2)
			RETURNING id
		`, label, []byte(req.Results)).Scan(&id)
		if err != nil {
			slog.Error("insert benchmark run", "err", err)
			writeErr(w, http.StatusInternalServerError, "could not save run")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"status": "ok", "id": id})
	}
}

func handleOptions(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.WriteHeader(http.StatusNoContent)
}

// ---- main ------------------------------------------------------------------

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	dbURL := envOr("DATABASE_URL", "postgresql://postgres:password@db:5432/bakeoff")
	port := envOr("PORT", "8080")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := pgxpool.New(ctx, dbURL)
	cancel()
	if err != nil {
		slog.Error("db connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := pool.Ping(pingCtx); err != nil {
		pingCancel()
		slog.Error("db ping failed", "err", err)
		os.Exit(1)
	}
	pingCancel()

	// 2 POST /results per hour, burst 2
	submitRL := newPerIPLimiter(rate.Every(time.Hour/2), 2)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth(pool))
	mux.HandleFunc("GET /results", handleGetResults(pool))
	mux.HandleFunc("POST /results", handlePostResults(pool, submitRL))
	mux.HandleFunc("OPTIONS /results", handleOptions)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", port),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	slog.Info("results-api starting", "port", port)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}
