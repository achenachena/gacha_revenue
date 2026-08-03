package ranking

import (
	"testing"
	"time"
)

func TestAggregateDistinguishesZeroFromMissing(t *testing.T) {
	start := time.Date(2025, 4, 30, 0, 0, 0, 0, time.UTC)
	game := []Snapshot{{Hour: start, Rank: 2}, {Hour: start.Add(time.Hour), Rank: 3}}
	app := []Snapshot{{Hour: start, Rank: 1}, {Hour: start.Add(time.Hour), Rank: 2}}
	result := Aggregate("anaxa", start, start.Add(3*time.Hour), game, app)
	if result.HoursAbove != 0 || result.ObservedHours != 2 || result.Coverage != 2.0/3.0 {
		t.Fatalf("unexpected complete-zero result: %+v", result)
	}

	missing := Aggregate("missing", start, start.Add(3*time.Hour), game, nil)
	if missing.HoursAbove != 0 || missing.ObservedHours != 0 || missing.Coverage != 0 {
		t.Fatalf("missing data must not be treated as observed zero: %+v", missing)
	}
}

func TestSortRanksByHoursAbove(t *testing.T) {
	results := []Result{{BannerID: "wuwa-31-aemeath", HoursAbove: 15}, {BannerID: "wuwa-24-cartethyia", HoursAbove: 18}}
	Sort(results)
	if results[0].BannerID != "wuwa-24-cartethyia" || results[1].BannerID != "wuwa-31-aemeath" {
		t.Fatalf("unexpected ranking order: %+v", results)
	}
}
