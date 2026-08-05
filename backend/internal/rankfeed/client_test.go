package rankfeed

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) Do(request *http.Request) (*http.Response, error) { return fn(request) }

func TestClientReadsNormalizedHistory(t *testing.T) {
	client, err := New(roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Query().Get("game_id") != "hsr" || request.Header.Get("Authorization") != "Bearer secret" {
			t.Fatal("missing normalized query or authorization")
		}
		body := `{"data":[{"observed_hour":"2026-04-22T01:00:00Z","markets":{"CN":{"games":{"hsr":2},"app_lines":{"tencent_video":4}}}}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}), "https://rank.example/history", "secret")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	items, err := client.QueryRange(context.Background(), "hsr", start, start.Add(24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Markets["CN"].Games["hsr"] != 2 {
		t.Fatalf("unexpected history: %+v", items)
	}
}

func TestValidateHonorsProviderFeedDepth(t *testing.T) {
	start := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	items := []rankstore.Snapshot{{
		ObservedHour: start,
		Markets: map[string]rankstore.MarketSnapshot{
			"CN": {FeedLimit: 200, Games: map[string]int{"hsr": 175}},
		},
	}}
	if err := validate(items, "hsr", start, start.Add(time.Hour)); err != nil {
		t.Fatalf("valid Top 200 rank was rejected: %v", err)
	}
	items[0].Markets["CN"] = rankstore.MarketSnapshot{FeedLimit: 100, Games: map[string]int{"hsr": 175}}
	if err := validate(items, "hsr", start, start.Add(time.Hour)); err == nil {
		t.Fatal("rank outside the provider's declared feed depth must be rejected")
	}
}

func TestClientNormalizesRanksOutsideTop200(t *testing.T) {
	client, err := New(roundTripFunc(func(*http.Request) (*http.Response, error) {
		body := `{"data":[{"observed_hour":"2026-04-22T01:00:00Z","markets":{"CN":{"feed_limit":500,"games":{"hsr":250},"app_lines":{"tencent_video":225}}}}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}), "https://rank.example/history", "")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	items, err := client.QueryRange(context.Background(), "hsr", start, start.Add(24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	cn := items[0].Markets["CN"]
	if cn.FeedLimit != rankstore.ReportingRankLimit || len(cn.Games) != 0 || len(cn.AppLines) != 0 {
		t.Fatalf("rank data was not normalized to Top 200: %+v", cn)
	}
}

func TestClientRejectsNonHourlySnapshot(t *testing.T) {
	if err := validate(nil, "hsr", time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("empty feed should be valid: %v", err)
	}
	client, err := New(roundTripFunc(func(*http.Request) (*http.Response, error) {
		body := `{"data":[{"observed_hour":"2026-04-22T01:30:00Z","markets":{}}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}), "https://rank.example/history", "")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	if _, err := client.QueryRange(context.Background(), "hsr", start, start.Add(24*time.Hour)); err == nil {
		t.Fatal("expected non-hourly snapshot to be rejected")
	}
}
