package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"gacha-revenue/backend/internal/applefeed"
	"gacha-revenue/backend/internal/rankstore"
)

type collectorHandler struct {
	collector *applefeed.Collector
	store     *rankstore.Store
	logger    *slog.Logger
}

func main() {
	ctx := context.Background()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	tableName := os.Getenv("DYNAMODB_TABLE")
	if tableName == "" {
		logger.Error("DYNAMODB_TABLE is required")
		os.Exit(1)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("load AWS config", "error", err)
		os.Exit(1)
	}
	handler := &collectorHandler{
		collector: applefeed.New(&http.Client{Timeout: 20 * time.Second}),
		store:     rankstore.New(dynamodb.NewFromConfig(awsCfg), tableName),
		logger:    logger,
	}
	lambda.Start(handler.Handle)
}

func (h *collectorHandler) Handle(ctx context.Context) (map[string]any, error) {
	observedHour := time.Now().UTC().Truncate(time.Hour)
	snapshot, err := h.collector.Collect(ctx, observedHour)
	if err != nil {
		return nil, fmt.Errorf("collect Apple rankings: %w", err)
	}
	if err := h.store.PutSnapshot(ctx, snapshot); err != nil {
		return nil, err
	}
	h.logger.Info("Apple public ranks stored", "observed_hour", observedHour, "markets", len(snapshot.Markets))
	return map[string]any{"status": "ok", "observed_hour": observedHour, "markets": len(snapshot.Markets)}, nil
}
