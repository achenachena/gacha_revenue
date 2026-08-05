package bannerstats

import (
	"testing"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

func TestAggregatePreservesFeedDepthAndAppLineSemantics(t *testing.T) {
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	snapshots := []rankstore.Snapshot{
		{ObservedHour: start, Markets: map[string]rankstore.MarketSnapshot{
			"CN": {FeedLimit: 200, Games: map[string]int{"hsr": 5}, AppLines: map[string]int{"tencent_video": 10}},
		}},
		{ObservedHour: start.Add(time.Hour), Markets: map[string]rankstore.MarketSnapshot{
			"CN": {FeedLimit: 200, Games: map[string]int{}, AppLines: map[string]int{"tencent_video": 9}},
		}},
		{ObservedHour: start.Add(2 * time.Hour), Markets: map[string]rankstore.MarketSnapshot{
			"CN": {FeedLimit: 200, Games: map[string]int{"hsr": 4}, AppLines: map[string]int{}},
		}},
	}

	result := Aggregate("hsr", start, start.Add(3*time.Hour), snapshots)
	cn := result.Ranks["CN"]
	if cn.PeakRank == nil || *cn.PeakRank != 4 || cn.LowestRank == nil || *cn.LowestRank != 5 {
		t.Fatalf("unexpected rank range: %+v", cn)
	}
	if !cn.LowestBeyondFeed || cn.FeedLimit != 200 {
		t.Fatalf("expected a Top 200 boundary, got %+v", cn)
	}
	for _, line := range result.AppLineObservations {
		if line.AppID == "tencent_video" && (line.HoursAbove != 2 || line.ObservedHours != 3) {
			t.Fatalf("unexpected app-line metric: %+v", line)
		}
	}
}

func TestAggregateOldSnapshotsDefaultToTop100(t *testing.T) {
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	result := Aggregate("hsr", start, start.Add(time.Hour), []rankstore.Snapshot{{
		ObservedHour: start,
		Markets:      map[string]rankstore.MarketSnapshot{"CN": {Games: map[string]int{}, AppLines: map[string]int{}}},
	}})
	cn := result.Ranks["CN"]
	if !cn.LowestBeyondFeed || cn.FeedLimit != rankstore.LegacyFeedLimit {
		t.Fatalf("unexpected legacy boundary: %+v", cn)
	}
}
