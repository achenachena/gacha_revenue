package httpapi

import (
	"context"
	"net/http"
	"time"

	"gacha-revenue/backend/internal/revenue"
)

type RevenueReader interface {
	List(context.Context) ([]revenue.GameHistory, error)
}

func (s *Server) publicRevenue(w http.ResponseWriter, r *http.Request) {
	histories, fallback := s.revenueHistories(r.Context())
	period := revenue.LatestPeriod(histories)
	byGame := make(map[string]revenue.GameHistory, len(histories))
	for _, history := range histories {
		byGame[history.GameID] = history
	}
	summaries := make([]revenue.GameSummary, 0, len(revenue.Definitions))
	latestFetch := time.Time{}
	totalLatest, totalYTD, coveredGames := 0.0, 0.0, 0
	for _, definition := range revenue.Definitions {
		history := byGame[definition.ID]
		summary := revenue.Summarize(definition, history, period)
		summaries = append(summaries, summary)
		if summary.Latest != nil {
			totalLatest += summary.Latest.Value
			coveredGames++
		}
		if summary.YTD != nil {
			totalYTD += *summary.YTD
		}
		if history.SourceFetchedAt.After(latestFetch) {
			latestFetch = history.SourceFetchedAt
		}
	}
	meta := responseMeta()
	meta["provider"] = "Sensor Tower estimates republished by GachaRevenue / GachaDash"
	meta["china_android_multiplier"] = revenue.ChinaAndroidMultiplier
	meta["latest_period"] = period
	meta["fetched_at"] = latestFetch
	meta["fallback_snapshot"] = fallback
	meta["aggregation_authority"] = "go_backend"
	meta["totals"] = map[string]any{"latest": totalLatest, "ytd": totalYTD, "covered_games": coveredGames, "games": len(revenue.Definitions)}
	w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=21600, stale-if-error=86400")
	writeJSON(w, http.StatusOK, map[string]any{"data": summaries, "meta": meta})
}

func (s *Server) revenueHistories(ctx context.Context) ([]revenue.GameHistory, bool) {
	archive := revenue.Archive()
	stored := []revenue.GameHistory(nil)
	fallback := s.revenueReader == nil
	if s.revenueReader != nil {
		var err error
		stored, err = s.revenueReader.List(ctx)
		if err != nil {
			s.logger.Warn("read persisted revenue histories", "error", err)
			fallback = true
		}
	}
	archiveByGame := make(map[string]revenue.GameHistory, len(archive))
	for _, history := range archive {
		archiveByGame[history.GameID] = history
	}
	for _, live := range stored {
		base := archiveByGame[live.GameID]
		live.History = revenue.Merge(base.History, live.History)
		if live.SourceURL == "" {
			live.SourceURL = base.SourceURL
		}
		if live.SourceFetchedAt.IsZero() {
			live.SourceFetchedAt = base.SourceFetchedAt
		}
		if live.SourceStatus == "" {
			live.SourceStatus = "persisted_public_source"
		}
		archiveByGame[live.GameID] = live
	}
	result := make([]revenue.GameHistory, 0, len(revenue.Definitions))
	for _, definition := range revenue.Definitions {
		result = append(result, archiveByGame[definition.ID])
	}
	return result, fallback || len(stored) < len(revenue.Definitions)
}
