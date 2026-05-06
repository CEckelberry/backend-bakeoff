.PHONY: dev clean-dev build test bench contract

# Local development: bring up docker-compose
dev:
	docker compose up --build

# Clean up: stop and remove containers
clean-dev:
	docker compose down -v

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
