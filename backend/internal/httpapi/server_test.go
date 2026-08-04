package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type exchangeRateRoundTripFunc func(*http.Request) (*http.Response, error)

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
	if last.GameID != "nte" || last.Period != "2026-06-01" || last.Estimate != 13.95 || last.Low != last.Estimate || last.High != last.Estimate {
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

func TestParsePublicRevenueSourceUsesPublishedTotals(t *testing.T) {
	body := `before \"revenueHistory\":[{\"year\":2026,\"month\":5,\"revenue_total\":3876500000},{\"year\":2026,\"month\":4,\"revenue_total\":5810000000}] after`
	history, err := parsePublicRevenueSource(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].Year != 2026 || history[0].Month != 4 || history[0].Value != 58.1 || history[1].Value != 38.765 {
		t.Fatalf("unexpected public revenue history: %+v", history)
	}
}

func TestParsePublicRevenueSourceRejectsDuplicateMonths(t *testing.T) {
	body := `\"revenueHistory\":[{\"year\":2026,\"month\":4,\"revenue_total\":5810000000},{\"year\":2026,\"month\":4,\"revenue_total\":3876500000}]`
	if _, err := parsePublicRevenueSource(body); err == nil {
		t.Fatal("expected duplicate source month to be rejected")
	}
}

func TestMergePublicRevenueHistoryPreservesArchiveAndLetsLiveDataWin(t *testing.T) {
	archive := []publicRevenueMonth{
		{Year: 2025, Month: 6, Value: 19.12},
		{Year: 2025, Month: 7, Value: 90},
	}
	live := []publicRevenueMonth{
		{Year: 2025, Month: 7, Value: 92.45},
		{Year: 2025, Month: 8, Value: 29.925},
	}
	merged := mergePublicRevenueHistory(archive, live)
	if len(merged) != 3 || merged[0].Month != 6 || merged[0].Value != 19.12 || merged[1].Month != 7 || merged[1].Value != 92.45 || merged[2].Month != 8 {
		t.Fatalf("unexpected merged history: %+v", merged)
	}
}

func TestPublicRevenueFixtureIncludesNevernessToEverness(t *testing.T) {
	for _, game := range fixturePublicRevenue() {
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
	if len(payload.Data) != 2 || payload.Data[0].CharactersZh != "爱弥斯" || payload.Data[1].CharactersZh != "卡提希娅" {
		t.Fatalf("unexpected version corrections: %+v", payload.Data)
	}
	for _, version := range payload.Data {
		if len(version.AppHours) != 1 || version.AppHours[0].Hours == nil {
			t.Fatalf("expected only the supplied correction to be known: %+v", version)
		}
	}
}
