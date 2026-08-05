package applefeed

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type fakeHTTPClient struct{}

func (fakeHTTPClient) Do(request *http.Request) (*http.Response, error) {
	if !strings.Contains(request.URL.Path, "/limit=200/") {
		return nil, fmt.Errorf("collector did not request Top 200: %s", request.URL.Path)
	}
	entries := `{"id":{"attributes":{"im:id":"1599719154"}}}`
	if strings.Contains(request.URL.Path, "/cn/") {
		entries = `{"id":{"attributes":{"im:id":"1523037824"}}},{"id":{"attributes":{"im:id":"458318329"}}}`
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"feed":{"entry":[` + entries + `]}}`)),
		Header:     make(http.Header),
	}, nil
}

func TestCollectMapsStoreIDsWithoutInventingMissingRanks(t *testing.T) {
	observed := time.Date(2026, 8, 3, 12, 34, 0, 0, time.UTC)
	snapshot, err := New(fakeHTTPClient{}).Collect(t.Context(), observed)
	if err != nil {
		t.Fatal(err)
	}
	if !snapshot.ObservedHour.Equal(observed.Truncate(time.Hour)) {
		t.Fatalf("unexpected observed hour: %s", snapshot.ObservedHour)
	}
	if snapshot.Markets["CN"].Games["hsr"] != 1 || snapshot.Markets["CN"].AppLines["tencent_video"] != 2 {
		t.Fatalf("unexpected CN snapshot: %+v", snapshot.Markets["CN"])
	}
	if snapshot.Markets["JP"].Games["hsr"] != 1 {
		t.Fatalf("unexpected JP snapshot: %+v", snapshot.Markets["JP"])
	}
	if _, exists := snapshot.Markets["CN"].Games["genshin"]; exists {
		t.Fatal("missing games must stay absent instead of receiving a made-up rank")
	}
}
