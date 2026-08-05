package rankstore

import (
	"testing"
	"time"
)

func TestMonthsBetweenIncludesEachTouchedPartition(t *testing.T) {
	start := time.Date(2026, 1, 31, 12, 0, 0, 0, time.UTC)
	end := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	months := monthsBetween(start, end)
	if len(months) != 2 || months[0].Month() != time.January || months[1].Month() != time.February {
		t.Fatalf("unexpected month partitions: %+v", months)
	}
}

func TestNormalizeReportingRangeStoresOnlyTop200Ranks(t *testing.T) {
	snapshot := NormalizeReportingRange(Snapshot{Markets: map[string]MarketSnapshot{
		"CN": {
			FeedLimit: 500,
			Games:     map[string]int{"hsr": 200, "wuwa": 201},
			AppLines:  map[string]int{"douyin": 1, "quark": 350},
		},
	}})
	cn := snapshot.Markets["CN"]
	if cn.FeedLimit != ReportingRankLimit || cn.Games["hsr"] != 200 || len(cn.Games) != 1 || cn.AppLines["douyin"] != 1 || len(cn.AppLines) != 1 {
		t.Fatalf("unexpected normalized snapshot: %+v", cn)
	}
}
