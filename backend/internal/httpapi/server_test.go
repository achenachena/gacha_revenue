package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"gacha-revenue/backend/internal/config"
)

func TestGamesIncludesEstimateMetadata(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/games", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var payload struct {
		Data []gameFixture  `json:"data"`
		Meta map[string]any `json:"meta"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 6 {
		t.Fatalf("expected 6 games, got %d", len(payload.Data))
	}
	if payload.Meta["basis"] != "mobile_iap_ios_android_with_cn_android_1_75x" {
		t.Fatalf("unexpected basis: %v", payload.Meta["basis"])
	}
}

func TestRevenueReturnsLabelledPublicSourceSnapshot(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/revenue?grain=month", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	var payload struct {
		Data []revenuePoint `json:"data"`
		Meta map[string]any `json:"meta"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 33 {
		t.Fatalf("expected 33 monthly source points, got %d", len(payload.Data))
	}
	if payload.Meta["data_status"] != "public_source_snapshot_with_automatic_rank_observations" {
		t.Fatalf("unexpected data status: %v", payload.Meta["data_status"])
	}
	last := payload.Data[len(payload.Data)-1]
	if last.GameID != "nte" || last.Period != "2026-06-01" || last.Estimate != 13.95 || last.Low != last.Estimate || last.High != last.Estimate {
		t.Fatalf("unexpected final source point: %+v", last)
	}
}

func TestParsePublicRevenueSourceUsesPublishedTotals(t *testing.T) {
	body := `before \"revenueHistory\":[{\"year\":2026,\"month\":4,\"revenue_total\":5810000000},{\"year\":2026,\"month\":5,\"revenue_total\":3876500000}] after`
	history, err := parsePublicRevenueSource(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].Year != 2026 || history[0].Month != 4 || history[0].Value != 58.1 || history[1].Value != 38.765 {
		t.Fatalf("unexpected public revenue history: %+v", history)
	}
}

func TestAppLineRankingUsesOnlyKnownObservations(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/app-line-rankings?game_id=wuwa&app_line_id=tencent_video", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	var payload struct {
		Data []struct {
			Rank       int     `json:"rank"`
			Characters string  `json:"characters"`
			Hours      float64 `json:"hours_above"`
		} `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 2 || payload.Data[0].Characters != "卡提希娅" || payload.Data[0].Hours != 18 || payload.Data[1].Characters != "爱弥斯" || payload.Data[1].Hours != 15 {
		t.Fatalf("unexpected verified ranking: %+v", payload.Data)
	}
}

func TestAnaxaDidNotExceedDouyin(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/app-line-rankings?game_id=hsr&app_line_id=douyin", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	var payload struct {
		Data []struct {
			Characters string  `json:"characters"`
			Hours      float64 `json:"hours_above"`
		} `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 1 || payload.Data[0].Characters != "那刻夏" || payload.Data[0].Hours != 0 {
		t.Fatalf("unexpected Anaxa correction: %+v", payload.Data)
	}
}
