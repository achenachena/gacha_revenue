package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"gacha-revenue/backend/internal/revenue"
	"gacha-revenue/backend/internal/revenuesource"
)

type fakeRevenueCollector struct{ results []revenuesource.Result }

func (collector fakeRevenueCollector) FetchAll(context.Context) []revenuesource.Result {
	return collector.results
}

type fakeRevenueWriter struct{ histories []revenue.GameHistory }

func (writer *fakeRevenueWriter) Put(_ context.Context, history revenue.GameHistory) error {
	writer.histories = append(writer.histories, history)
	return nil
}

func TestRevenueJobPreservesFailuresAndStoresValidatedSuccesses(t *testing.T) {
	writer := &fakeRevenueWriter{}
	handler := collectorHandler{
		revenueCollector: fakeRevenueCollector{results: []revenuesource.Result{
			{History: revenue.GameHistory{GameID: "hsr", History: []revenue.Month{{Year: 2026, Month: 7, Value: 50}}}},
			{History: revenue.GameHistory{GameID: "wuwa"}, Err: errors.New("upstream unavailable")},
		}},
		revenueStore: writer,
		logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	response, err := handler.Handle(context.Background(), collectorEvent{Job: "revenue"})
	if err != nil {
		t.Fatal(err)
	}
	if response["stored"] != 1 || response["failed"] != 1 || len(writer.histories) != 1 {
		t.Fatalf("unexpected collector response: %+v, writes=%d", response, len(writer.histories))
	}
	history := writer.histories[0].History
	latest := history[len(history)-1]
	if len(history) < 7 || latest.Year != 2026 || latest.Month != 7 || latest.Value != 50 || latest.MarketCoverage != revenue.MarketCoverageComplete {
		t.Fatalf("expected archive merged with latest source month: %+v", history)
	}
}

func TestRevenueJobFailsWhenEverySourceFails(t *testing.T) {
	handler := collectorHandler{
		revenueCollector: fakeRevenueCollector{results: []revenuesource.Result{{History: revenue.GameHistory{GameID: "hsr"}, Err: errors.New("failed")}}},
		revenueStore:     &fakeRevenueWriter{},
		logger:           slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	if _, err := handler.Handle(context.Background(), collectorEvent{Job: "revenue"}); err == nil {
		t.Fatal("expected complete source failure to fail the scheduled invocation")
	}
}

func TestCollectorRejectsUnknownJob(t *testing.T) {
	handler := collectorHandler{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	if _, err := handler.Handle(context.Background(), collectorEvent{Job: "unexpected"}); err == nil {
		t.Fatal("expected unsupported job to be rejected")
	}
}
