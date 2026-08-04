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
	"gacha-revenue/backend/internal/revenue"
	"gacha-revenue/backend/internal/revenuesource"
	"gacha-revenue/backend/internal/revenuestore"
)

type collectorHandler struct {
	rankCollector    rankCollector
	rankStore        rankWriter
	revenueCollector revenueCollector
	revenueStore     revenueWriter
	logger           *slog.Logger
}

type rankCollector interface {
	Collect(context.Context, time.Time) (rankstore.Snapshot, error)
}
type rankWriter interface {
	PutSnapshot(context.Context, rankstore.Snapshot) error
}
type revenueCollector interface {
	FetchAll(context.Context) []revenuesource.Result
}
type revenueWriter interface {
	Put(context.Context, revenue.GameHistory) error
}

type collectorEvent struct {
	Job string `json:"job"`
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
	providerClient := &http.Client{
		Timeout:       20 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	dynamoClient := dynamodb.NewFromConfig(awsCfg)
	handler := &collectorHandler{
		rankCollector:    applefeed.New(providerClient),
		rankStore:        rankstore.New(dynamoClient, tableName),
		revenueCollector: revenuesource.New(providerClient),
		revenueStore:     revenuestore.New(dynamoClient, tableName),
		logger:           logger,
	}
	lambda.Start(handler.Handle)
}

func (h *collectorHandler) Handle(ctx context.Context, event collectorEvent) (map[string]any, error) {
	if event.Job == "revenue" {
		return h.collectRevenue(ctx)
	}
	if event.Job != "" && event.Job != "rank" {
		return nil, fmt.Errorf("unsupported collector job %q", event.Job)
	}
	observedHour := time.Now().UTC().Truncate(time.Hour)
	snapshot, err := h.rankCollector.Collect(ctx, observedHour)
	if err != nil {
		return nil, fmt.Errorf("collect Apple rankings: %w", err)
	}
	if err := h.rankStore.PutSnapshot(ctx, snapshot); err != nil {
		return nil, err
	}
	h.logger.Info("Apple public ranks stored", "observed_hour", observedHour, "markets", len(snapshot.Markets))
	return map[string]any{"status": "ok", "observed_hour": observedHour, "markets": len(snapshot.Markets)}, nil
}

func (h *collectorHandler) collectRevenue(ctx context.Context) (map[string]any, error) {
	results := h.revenueCollector.FetchAll(ctx)
	archive := make(map[string][]revenue.Month, len(revenue.Definitions))
	for _, history := range revenue.Archive() {
		archive[history.GameID] = history.History
	}
	stored, failed := 0, 0
	for _, result := range results {
		if result.Err != nil {
			failed++
			h.logger.Warn("revenue source refresh failed", "game_id", result.History.GameID, "error", result.Err)
			continue
		}
		result.History.History = revenue.Merge(archive[result.History.GameID], result.History.History)
		if err := h.revenueStore.Put(ctx, result.History); err != nil {
			failed++
			h.logger.Error("persist revenue source", "game_id", result.History.GameID, "error", err)
			continue
		}
		stored++
	}
	if stored == 0 {
		return nil, fmt.Errorf("all revenue source refreshes failed")
	}
	h.logger.Info("public revenue histories stored", "stored", stored, "failed", failed)
	return map[string]any{"status": "ok", "job": "revenue", "stored": stored, "failed": failed}, nil
}
