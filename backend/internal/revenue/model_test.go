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

func TestPartialMarketHistoryRemainsExplicitThroughAnnualAndPhaseAggregates(t *testing.T) {
	history := []Month{
		{Year: 2023, Month: 11, Value: 19, MarketCoverage: MarketCoveragePartial, Scope: ScopeGlobalExcludingCN},
		{Year: 2023, Month: 12, Value: 28, MarketCoverage: MarketCoveragePartial, Scope: ScopeGlobalExcludingCN},
	}
	summary := Summarize(GameDefinition{ID: "hsr"}, GameHistory{GameID: "hsr", History: history}, &Period{Year: 2023, Month: 12})
	if len(summary.Yearly) != 1 || summary.Yearly[0].Complete || summary.Yearly[0].MarketCoverage != MarketCoveragePartial || len(summary.Yearly[0].Scopes) != 1 || summary.Yearly[0].Scopes[0] != ScopeGlobalExcludingCN {
		t.Fatalf("unexpected annual scope: %+v", summary.Yearly)
	}
	estimate := EstimateWindow(history, "2023-11-15", "2023-12-15")
	if estimate.Estimate == nil || estimate.MarketCoverage != MarketCoveragePartial || estimate.Scope != ScopeGlobalExcludingCN {
		t.Fatalf("unexpected phase scope: %+v", estimate)
	}
}

func TestMixedMarketPhaseIsNotMislabelledComplete(t *testing.T) {
	history := []Month{
		{Year: 2023, Month: 12, Value: 28, MarketCoverage: MarketCoveragePartial, Scope: ScopeGlobalExcludingCN},
		{Year: 2024, Month: 1, Value: 47.5},
	}
	estimate := EstimateWindow(history, "2023-12-20", "2024-01-10")
	if estimate.MarketCoverage != MarketCoverageMixed || estimate.Scope != ScopeMixed {
		t.Fatalf("expected mixed coverage, got %+v", estimate)
	}
}
