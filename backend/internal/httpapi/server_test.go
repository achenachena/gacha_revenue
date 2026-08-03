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
