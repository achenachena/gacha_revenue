package serverlessapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

type fakeReader struct {
	snapshots []rankstore.Snapshot
	err       error
}

func (f fakeReader) QueryRange(context.Context, time.Time, time.Time) ([]rankstore.Snapshot, error) {
	return f.snapshots, f.err
}

func TestBannerMetricsAggregatesVisibleRanksAndPairedAppHours(t *testing.T) {
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	reader := fakeReader{snapshots: []rankstore.Snapshot{
		{
			ObservedHour: start,
			Markets: map[string]rankstore.MarketSnapshot{
				"CN": {Games: map[string]int{"hsr": 5}, AppLines: map[string]int{"tencent_video": 10}},
				"JP": {Games: map[string]int{"hsr": 3}},
			},
		},
		{
			ObservedHour: start.Add(time.Hour),
			Markets: map[string]rankstore.MarketSnapshot{
				"CN": {Games: map[string]int{}, AppLines: map[string]int{"tencent_video": 9}},
				"JP": {Games: map[string]int{"hsr": 8}},
			},
		},
		{
			ObservedHour: start.Add(2 * time.Hour),
			Markets: map[string]rankstore.MarketSnapshot{
				"CN": {Games: map[string]int{"hsr": 4}, AppLines: map[string]int{}},
			},
		},
	}}
	fallback := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { http.NotFound(w, nil) })
	handler := New(reader, fallback, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/banner-metrics?game_id=hsr&start=2026-08-01&end=2026-08-03", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Data struct {
			Ranks map[string]struct {
				Peak       *int `json:"peak_rank"`
				Lowest     *int `json:"lowest_rank"`
				Observed   int  `json:"observed_hours"`
				Ranked     int  `json:"ranked_hours"`
				BeyondFeed bool `json:"lowest_is_beyond_feed"`
			} `json:"ranks"`
			Lines []struct {
				AppID    string `json:"app_id"`
				Hours    int    `json:"hours_above"`
				Observed int    `json:"observed_hours"`
			} `json:"app_line_observations"`
		} `json:"data"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	cn := response.Data.Ranks["CN"]
	if cn.Peak == nil || *cn.Peak != 4 || cn.Lowest == nil || *cn.Lowest != 5 || cn.Observed != 3 || cn.Ranked != 2 || !cn.BeyondFeed {
		t.Fatalf("unexpected CN range: %+v", cn)
	}
	jp := response.Data.Ranks["JP"]
	if jp.Peak == nil || *jp.Peak != 3 || jp.Lowest == nil || *jp.Lowest != 8 || jp.Observed != 2 || jp.Ranked != 2 || jp.BeyondFeed {
		t.Fatalf("unexpected JP range: %+v", jp)
	}
	var tencentHours, tencentObserved int
	for _, line := range response.Data.Lines {
		if line.AppID == "tencent_video" {
			tencentHours, tencentObserved = line.Hours, line.Observed
		}
	}
	if tencentHours != 2 || tencentObserved != 3 {
		t.Fatalf("expected conclusive comparisons when either side is visible, got hours=%d observed=%d", tencentHours, tencentObserved)
	}
}

func TestBannerMetricsRejectsOversizedWindow(t *testing.T) {
	handler := New(fakeReader{}, http.NotFoundHandler(), slog.New(slog.NewTextHandler(io.Discard, nil)), Options{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/banner-metrics?game_id=hsr&start=2026-01-01&end=2026-08-01", nil))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestBannerMetricsExplainsPreCollectionHistory(t *testing.T) {
	started := time.Date(2026, 8, 4, 2, 0, 0, 0, time.UTC)
	handler := New(fakeReader{}, http.NotFoundHandler(), slog.New(slog.NewTextHandler(io.Discard, nil)), Options{CollectionStartedAt: started})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/banner-metrics?game_id=hsr&start=2026-04-22&end=2026-05-13", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var response struct {
		Data struct {
			CoverageStatus string `json:"coverage_status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if response.Data.CoverageStatus != "historical_provider_required" {
		t.Fatalf("unexpected coverage status: %q", response.Data.CoverageStatus)
	}
}
