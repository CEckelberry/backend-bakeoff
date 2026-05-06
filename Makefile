.PHONY: dev clean-dev build test bench contract install setup

# Local development: bring up docker-compose
dev:
	docker compose up --build -d
	@echo ""
	@echo "✅ All services starting. Waiting for health checks..."
	@echo ""
	@sleep 5
	@echo "Services available on:"
	@echo "  - Postgres:     localhost:5433 (alt port, internal: db:5432)"
	@echo "  - Go backend:   localhost:8081"
	@echo "  - Rust backend: localhost:8082"
	@echo "  - Bun backend:  localhost:8083"
	@echo "  - Node backend: localhost:8084"
	@echo "  - Python backend: localhost:8085"
	@echo "  - PHP backend:  localhost:8086"
	@echo "  - Tax service:  localhost:8087"
	@echo "  - Router:       localhost:8090"
	@echo "  - Prometheus:   localhost:9091 (alt port, internal: 9090)"
	@echo "  - Grafana:      localhost:3001"
	@echo ""

# Clean up: stop and remove containers
clean-dev:
	docker compose down -v
	@echo "✅ All services stopped and volumes removed"

# Build: compile all services
build:
	@echo "Building all services..."

# Test: run test suites
test:
	@echo "Running tests..."

# Benchmark: run performance benchmarks
bench:
	@echo "Running benchmarks..."

# Contract: validate OpenAPI spec
contract:
	npx redocly lint api/openapi.yaml

# Install: install dependencies
install:
	pnpm install

# Setup: one-time initialization
setup:
	pnpm install
	git init
	git checkout -b phase-0-foundation || git switch phase-0-foundation
