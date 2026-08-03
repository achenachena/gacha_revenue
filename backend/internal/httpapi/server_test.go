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
	if payload.Meta["basis"] != "estimated_gross_bookings" {
		t.Fatalf("unexpected basis: %v", payload.Meta["basis"])
	}
}

func TestEditorEndpointRejectsViewer(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/v1/admin/ingestions", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestRevenueDoesNotReturnSyntheticFixtures(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/revenue?grain=month", nil)
	recorder := httptest.NewRecorder()
	New(config.Config{}, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(recorder, request)
	var payload struct {
		Data []revenuePoint `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 0 {
		t.Fatalf("expected no synthetic revenue fixtures, got %d", len(payload.Data))
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
