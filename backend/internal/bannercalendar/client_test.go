package bannercalendar

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) Do(request *http.Request) (*http.Response, error) { return fn(request) }

func TestClientValidatesAndFiltersFeed(t *testing.T) {
	client, err := New(roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Header.Get("Authorization") != "Bearer secret" {
			t.Fatal("missing bearer token")
		}
		body := `{"data":[{"id":"hsr-44-p1","game_id":"hsr","version":"4.4","phase_index":1,"characters_zh":"角色","characters_en":"Character","starts_at":"2026-07-15","ends_at":"2026-08-05","source_url":"https://example.com/banner","source_updated_at":"2026-07-15"},{"id":"wuwa-35-p1","game_id":"wuwa","version":"3.5","phase_index":1,"characters_zh":"角色","characters_en":"Character","starts_at":"2026-07-10","ends_at":"2026-07-31","source_updated_at":"2026-07-10"}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}), "https://calendar.example/feed", "secret")
	if err != nil {
		t.Fatal(err)
	}
	items, err := client.List(context.Background(), "hsr")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "hsr-44-p1" || items[0].PhaseZh != "第 1 期" || items[0].PhaseEn != "Phase 1" {
		t.Fatalf("unexpected items: %+v", items)
	}
}

func TestClientUsesLastGoodCalendarDuringProviderFailure(t *testing.T) {
	calls := 0
	client, err := New(roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		calls++
		if calls > 1 {
			return nil, errors.New("provider unavailable")
		}
		body := `{"data":[{"id":"hsr-44-p1","game_id":"hsr","version":"4.4","phase_index":1,"characters_zh":"角色","characters_en":"Character","starts_at":"2026-07-15","ends_at":"2026-08-05","source_updated_at":"2026-07-15"}]}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
	}), "https://calendar.example/feed", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.List(t.Context(), "hsr"); err != nil {
		t.Fatal(err)
	}
	client.fetchedAt = time.Now().Add(-2 * cacheTTL)
	items, err := client.List(t.Context(), "hsr")
	if err != nil || len(items) != 1 || items[0].ID != "hsr-44-p1" {
		t.Fatalf("expected stale last-good calendar, got %+v, %v", items, err)
	}
}

func TestClientRejectsInsecureFeedURL(t *testing.T) {
	if _, err := New(roundTripFunc(nil), "http://calendar.example/feed", ""); err == nil {
		t.Fatal("expected insecure URL to be rejected")
	}
}
