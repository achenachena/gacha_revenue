package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"gacha-revenue/backend/internal/config"
	"gacha-revenue/backend/migrations"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := migrations.Up(ctx, cfg.DatabaseURL); err != nil {
		logger.Error("database migration failed", "error", err)
		os.Exit(1)
	}
	logger.Info("database migrations complete")
}
