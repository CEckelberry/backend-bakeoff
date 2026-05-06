package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL   string
	TaxServiceURL string
	LogLevel      string
	RuntimeName   string
	ListenAddr    string
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		TaxServiceURL: os.Getenv("TAX_SERVICE_URL"),
		LogLevel:      getEnv("LOG_LEVEL", "info"),
		RuntimeName:   getEnv("RUNTIME_NAME", "go"),
		ListenAddr:    getEnv("LISTEN_ADDR", ":8080"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.TaxServiceURL == "" {
		return nil, fmt.Errorf("TAX_SERVICE_URL is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
