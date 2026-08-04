package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gacha-revenue/backend/internal/revenue"
)

type exchangeRateRoundTripFunc func(*http.Request) (*http.Response, error)

type fakeRevenueReader struct {
	histories []revenue.GameHistory
	err       error
}

func (reader fakeRevenueReader) List(context.Context) ([]revenue.GameHistory, error) {
	return reader.histories, reader.err
}

func (function exchangeRateRoundTripFunc) Do(request *http.Request) (*http.Response, error) {
	return function(request)
}

func TestFetchExchangeRateUsesECBDailyReferenceRate(t *testing.T) {
	client := exchangeRateRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.String() != exchangeRateSourceURL {
			t.Fatalf("unexpected exchange-rate URL: %s", request.URL)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"date":"2026-08-03","base":"USD","quote":"CNY","rate":6.7526}`)),
		}, nil
	})
	rate, err := fetchExchangeRate(context.Background(), client)
	if err != nil {
		t.Fatal(err)
	}
	if rate.Rate != 6.7526 || rate.Date != "2026-08-03" || rate.Provider != "European Central Bank via Frankfurter" {
		t.Fatalf("unexpected exchange rate: %+v", rate)
	}
}

func TestFetchExchangeRateRejectsImplausibleValues(t *testing.T) {
	client := exchangeRateRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"date":"2026-08-03","base":"USD","quote":"CNY","rate":999}`)),
		}, nil
	})
	if _, err := fetchExchangeRate(context.Background(), client); err == nil {
		t.Fatal("expected implausible exchange rate to be rejected")
	}
}

func TestGamesIncludesEstimateMetadata(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/games", nil)
	recorder := httptest.NewRecorder()
	New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var payload struct {
		Data []revenue.GameDefinition `json:"data"`
		Meta map[string]any           `json:"meta"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 6 {
		t.Fatalf("expected 6 games, got %d", len(payload.Data))
	}
	if payload.Meta["basis"] != revenue.Basis {
		t.Fatalf("unexpected basis: %v", payload.Meta["basis"])
	}
}

func TestMethodologyIsServedByTheGoDomain(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/methodology", nil)
	recorder := httptest.NewRecorder()
	New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var payload struct {
		Data revenue.MethodologyDocument `json:"data"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Data.Version != revenue.MethodologyVersion || len(payload.Data.Formulas) != 4 || payload.Data.Formulas[2].Expression != "R[g,p] = sum_m M[g,m] x overlap_hours[p,m] / month_hours[m]" {
		t.Fatalf("unexpected backend methodology: %+v", payload.Data)
	}
}

func TestRevenueReturnsLabelledPublicSourceSnapshot(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/revenue?grain=month", nil)
	recorder := httptest.NewRecorder()
	New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil).ServeHTTP(recorder, request)
	var payload struct {
		Data []revenuePoint `json:"data"`
		Meta map[string]any `json:"meta"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 119 {
		t.Fatalf("expected 119 monthly source points, got %d", len(payload.Data))
	}
	if payload.Meta["data_status"] != "public_source_snapshot_with_automatic_rank_observations" {
		t.Fatalf("unexpected data status: %v", payload.Meta["data_status"])
	}
	last := payload.Data[len(payload.Data)-1]
	if last.GameID != "nte" || last.Period != "2026-06-01" || last.Estimate != 13.95 || last.Low != nil || last.High != nil {
		t.Fatalf("unexpected final source point: %+v", last)
	}
}

func TestRevenueIncludesReliablePreJuly2025History(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/revenue?grain=month", nil)
	recorder := httptest.NewRecorder()
	New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil).ServeHTTP(recorder, request)
	var payload struct {
		Data []revenuePoint `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	want := map[string]float64{
		"genshin/2024-01-01": 99.25,
		"hsr/2025-04-01":     103.45,
		"zzz/2024-07-01":     99.75,
		"wuwa/2024-05-01":    25.75,
	}
	for _, point := range payload.Data {
		key := point.GameID + "/" + point.Period
		if expected, ok := want[key]; ok {
			if point.Estimate != expected {
				t.Fatalf("unexpected estimate for %s: got %v want %v", key, point.Estimate, expected)
			}
			delete(want, key)
		}
		if (point.GameID == "genshin" || point.GameID == "hsr") && point.Period < "2024-01-01" {
			t.Fatalf("incomplete pre-2024 regional total must not be published: %+v", point)
		}
	}
	if len(want) != 0 {
		t.Fatalf("missing historical source points: %v", want)
	}
}

func TestPublicRevenueFixtureIncludesNevernessToEverness(t *testing.T) {
	for _, game := range revenue.Archive() {
		if game.GameID != "nte" {
			continue
		}
		if len(game.History) != 3 || game.History[2].Year != 2026 || game.History[2].Month != 6 || game.History[2].Value != 13.95 {
			t.Fatalf("unexpected Neverness to Everness history: %+v", game.History)
		}
		return
	}
	t.Fatal("Neverness to Everness was missing from the public revenue fixture")
}

func TestPublicRevenueReturnsBackendAggregatesAtAlignedLatestPeriod(t *testing.T) {
	reader := fakeRevenueReader{histories: []revenue.GameHistory{{
		GameID:          "hsr",
		History:         []revenue.Month{{Year: 2026, Month: 6, Value: 30}, {Year: 2026, Month: 7, Value: 60}},
		SourceURL:       "https://www.gachadash.com/game/honkai-star-rail",
		SourceFetchedAt: time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC),
		SourceStatus:    "live_public_source",
	}}}
	request := httptest.NewRequest(http.MethodGet, "/v1/public-revenue", nil)
	recorder := httptest.NewRecorder()
	NewWithOptions(slog.New(slog.NewTextHandler(io.Discard, nil)), nil, Options{Revenue: reader}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var payload struct {
		Data []revenue.GameSummary `json:"data"`
		Meta struct {
			LatestPeriod         revenue.Period `json:"latest_period"`
			AggregationAuthority string         `json:"aggregation_authority"`
		} `json:"meta"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Meta.LatestPeriod != (revenue.Period{Year: 2026, Month: 7}) || payload.Meta.AggregationAuthority != "go_backend" {
		t.Fatalf("unexpected response metadata: %+v", payload.Meta)
	}
	for _, game := range payload.Data {
		if game.ID != "hsr" {
			continue
		}
		if game.GameID != game.ID {
			t.Fatalf("expected backward-compatible game_id alias, got %+v", game)
		}
		if game.Latest == nil || game.Latest.Value != 60 || game.YTD == nil || math.Abs(*game.YTD-247.7675) > 0.000001 || game.ChangePercent == nil || *game.ChangePercent != 100 {
			t.Fatalf("unexpected backend aggregate: %+v", game)
		}
		return
	}
	t.Fatal("missing HSR aggregate")
}

func TestVersionsPreserveOwnerCorrectionsWithoutInventingUnknownHours(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/versions?game_id=wuwa", nil)
	recorder := httptest.NewRecorder()
	New(slog.New(slog.NewTextHandler(io.Discard, nil)), nil).ServeHTTP(recorder, request)
	var payload struct {
		Data []versionFixture `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader(recorder.Body.Bytes())).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{"ww-31-aemeath": false, "ww-24-cartethyia": false}
	for _, version := range payload.Data {
		if _, ok := found[version.ID]; !ok {
			continue
		}
		found[version.ID] = true
		known := 0
		for _, observation := range version.AppHours {
			if observation.Hours != nil {
				known++
			}
		}
		if known != 1 {
			t.Fatalf("expected exactly one supplied correction for %s, got %d", version.CharactersZh, known)
		}
	}
	for character, ok := range found {
		if !ok {
			t.Fatalf("missing owner correction for %s", character)
		}
	}
	for _, version := range payload.Data {
		if version.ID == "ww-24-cartethyia" && (version.Estimate == nil || version.RevenueFormula != revenue.VersionAllocationFormula || version.RevenueCoverage <= 0) {
			t.Fatalf("expected Go-computed version revenue: %+v", version)
		}
	}
}
