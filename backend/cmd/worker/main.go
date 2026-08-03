package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gacha-revenue/backend/internal/config"
)

// The production worker receives source-object keys from SQS, validates the
// licensed payload, stores normalized observations, and publishes one
// idempotent aggregation job. AWS clients are injected in the deployment build;
// this command keeps the local worker lifecycle and health behavior deterministic.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Info("ingestion worker ready", "queue", cfg.IngestionQueue, "bucket", cfg.RawDataBucket)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			logger.Info("ingestion worker stopped")
			return
		case <-ticker.C:
			logger.Info("worker heartbeat")
		}
	}
}
