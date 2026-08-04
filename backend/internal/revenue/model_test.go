package revenue

import "testing"

func TestMergePreservesArchiveAndLetsLiveDataWin(t *testing.T) {
	archive := []Month{{Year: 2025, Month: 6, Value: 19.12}, {Year: 2025, Month: 7, Value: 90}}
	live := []Month{{Year: 2025, Month: 7, Value: 92.45}, {Year: 2025, Month: 8, Value: 29.925}}
	merged := Merge(archive, live)
	if len(merged) != 3 || merged[0].Month != 6 || merged[1].Value != 92.45 || merged[2].Month != 8 {
		t.Fatalf("unexpected merged history: %+v", merged)
	}
}

func TestSummarizeUsesAlignedPeriodAndCalendarMonthChange(t *testing.T) {
	history := GameHistory{GameID: "hsr", History: []Month{{Year: 2026, Month: 1, Value: 8}, {Year: 2026, Month: 2, Value: 20}, {Year: 2026, Month: 3, Value: 10}}}
	summary := Summarize(GameDefinition{ID: "hsr"}, history, &Period{Year: 2026, Month: 3})
	if summary.YTD == nil || *summary.YTD != 38 || summary.ChangePercent == nil || *summary.ChangePercent != -50 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
}

func TestEstimateWindowAllocatesEachMonthByExactOverlap(t *testing.T) {
	estimate := EstimateWindow([]Month{{Year: 2026, Month: 1, Value: 31}, {Year: 2026, Month: 2, Value: 28}}, "2026-01-16", "2026-02-15")
	if estimate.Estimate == nil || *estimate.Estimate != 30 || estimate.Coverage != 1 || estimate.WindowHours != 720 {
		t.Fatalf("unexpected phase estimate: %+v", estimate)
	}
}
