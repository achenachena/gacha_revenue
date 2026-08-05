package serverlessapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"gacha-revenue/backend/internal/bannerstats"
	"gacha-revenue/backend/internal/rankstore"
	"gacha-revenue/backend/internal/revenue"
	"gacha-revenue/backend/internal/versioncatalog"
)

var trackedGames = map[string]bool{"genshin": true, "hsr": true, "zzz": true, "wuwa": true, "endfield": true, "nte": true}

type Reader interface {
	QueryRange(ctx context.Context, start, end time.Time) ([]rankstore.Snapshot, error)
}

type HistoryReader interface {
	QueryRange(ctx context.Context, gameID string, start, end time.Time) ([]rankstore.Snapshot, error)
}

type Handler struct {
	reader              Reader
	fallback            http.Handler
	logger              *slog.Logger
	collectionStartedAt time.Time
	history             HistoryReader
	revenue             RevenueReader
	now                 func() time.Time
}

type Options struct {
	CollectionStartedAt time.Time
	History             HistoryReader
	Revenue             RevenueReader
}

type RevenueReader interface {
	List(context.Context) ([]revenue.GameHistory, error)
}

func New(reader Reader, fallback http.Handler, logger *slog.Logger, options Options) http.Handler {
	return &Handler{reader: reader, fallback: fallback, logger: logger, collectionStartedAt: options.CollectionStartedAt.UTC(), history: options.History, revenue: options.Revenue, now: time.Now}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet && r.URL.Path == "/v1/banner-metrics" {
		h.bannerMetrics(w, r)
		return
	}
	if r.Method == http.MethodGet && r.URL.Path == "/v1/banner-rankings" {
		h.bannerRankings(w, r)
		return
	}
	h.fallback.ServeHTTP(w, r)
}

func (h *Handler) bannerMetrics(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	start, startErr := time.Parse("2006-01-02", r.URL.Query().Get("start"))
	end, endErr := time.Parse("2006-01-02", r.URL.Query().Get("end"))
	if !trackedGames[gameID] || startErr != nil || endErr != nil || !end.After(start) || end.Sub(start) > 62*24*time.Hour {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid game_id, start and end (maximum 62 days) are required"})
		return
	}
	snapshots, err := h.reader.QueryRange(r.Context(), start, end)
	if err != nil {
		h.logger.Error("query serverless banner metrics", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank query failed"})
		return
	}
	historyUsed := false
	if h.history != nil {
		providerEnd := minTime(end, h.now().UTC().Add(time.Hour))
		if providerEnd.After(start) {
			historical, historyErr := h.history.QueryRange(r.Context(), gameID, start, providerEnd)
			if historyErr != nil {
				h.logger.Error("query licensed hourly rank feed", "error", historyErr)
			} else if len(historical) > 0 {
				// The authorized provider is authoritative when both sources have
				// the same hour because it may expose a deeper Top 200 chart.
				snapshots = mergeSnapshots(snapshots, historical)
				historyUsed = true
			}
		}
	}

	metrics := bannerstats.Aggregate(gameID, start, end, snapshots)
	phaseRevenue := h.phaseRevenue(r.Context(), gameID, start, end, nil)
	writeJSON(w, http.StatusOK, map[string]any{
		"data": h.bannerResponse(metrics, start, end, len(snapshots), historyUsed, phaseRevenue),
		"meta": map[string]any{"game_id": gameID, "start": start, "end": end, "snapshot_hours": len(snapshots)},
	})
}

func (h *Handler) bannerRankings(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	if !trackedGames[gameID] || len(r.URL.Query()) != 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid game_id is required"})
		return
	}
	windows := versionWindows(gameID)
	if len(windows) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"data": []any{}, "meta": map[string]any{"game_id": gameID}})
		return
	}

	queryStart := windows[0].Start
	queryEnd := windows[len(windows)-1].End
	now := h.now().UTC().Add(time.Hour)
	if queryEnd.After(now) {
		queryEnd = now
	}
	if !h.collectionStartedAt.IsZero() && queryStart.Before(h.collectionStartedAt) {
		queryStart = h.collectionStartedAt
	}
	snapshots := []rankstore.Snapshot(nil)
	if queryEnd.After(queryStart) {
		var err error
		snapshots, err = h.reader.QueryRange(r.Context(), queryStart, queryEnd)
		if err != nil {
			h.logger.Error("query serverless banner ranking metrics", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank query failed"})
			return
		}
	}

	historical := []rankstore.Snapshot(nil)
	if h.history != nil {
		providerEnd := minTime(windows[len(windows)-1].End, now)
		if providerEnd.After(windows[0].Start) {
			var err error
			historical, err = h.queryHistoryChunks(r.Context(), gameID, windows[0].Start, providerEnd)
			if err != nil {
				h.logger.Error("query licensed rank history for banner rankings", "error", err)
				historical = nil
			} else if len(historical) > 0 {
				snapshots = mergeSnapshots(snapshots, historical)
			}
		}
	}

	revenueByGame := h.revenueHistories(r.Context())
	rows := make([]map[string]any, 0, len(windows))
	for _, window := range windows {
		windowSnapshots := snapshotsInWindow(snapshots, window.Start, window.End)
		metrics := bannerstats.Aggregate(gameID, window.Start, window.End, windowSnapshots)
		usedLicensedHistory := len(snapshotsInWindow(historical, window.Start, window.End)) > 0
		row := h.bannerResponse(
			metrics,
			window.Start,
			window.End,
			len(windowSnapshots),
			usedLicensedHistory,
			h.phaseRevenue(r.Context(), gameID, window.Start, window.End, revenueByGame),
		)
		row["version_id"] = window.ID
		rows = append(rows, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": rows,
		"meta": map[string]any{"game_id": gameID, "windows": len(rows), "snapshot_hours": len(snapshots)},
	})
}

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}

type versionWindow struct {
	ID    string
	Start time.Time
	End   time.Time
}

func versionWindows(gameID string) []versionWindow {
	result := make([]versionWindow, 0)
	for _, version := range versioncatalog.List() {
		if version.GameID != gameID {
			continue
		}
		start, startErr := time.Parse("2006-01-02", version.StartsAt)
		end, endErr := time.Parse("2006-01-02", version.EndsAt)
		if startErr == nil && endErr == nil && end.After(start) {
			result = append(result, versionWindow{ID: version.ID, Start: start, End: end})
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Start.Before(result[j].Start) })
	return result
}

func snapshotsInWindow(snapshots []rankstore.Snapshot, start, end time.Time) []rankstore.Snapshot {
	result := make([]rankstore.Snapshot, 0)
	for _, snapshot := range snapshots {
		if !snapshot.ObservedHour.Before(start) && snapshot.ObservedHour.Before(end) {
			result = append(result, snapshot)
		}
	}
	return result
}

func (h *Handler) queryHistoryChunks(ctx context.Context, gameID string, start, end time.Time) ([]rankstore.Snapshot, error) {
	type chunk struct {
		start time.Time
		end   time.Time
	}
	chunks := make([]chunk, 0)
	for cursor := start; cursor.Before(end); {
		chunkEnd := cursor.Add(62 * 24 * time.Hour)
		if chunkEnd.After(end) {
			chunkEnd = end
		}
		chunks = append(chunks, chunk{start: cursor, end: chunkEnd})
		cursor = chunkEnd
	}
	if len(chunks) == 0 {
		return nil, nil
	}

	queryContext, cancel := context.WithCancel(ctx)
	defer cancel()
	parts := make([][]rankstore.Snapshot, len(chunks))
	semaphore := make(chan struct{}, 4)
	errors := make(chan error, 1)
	var workers sync.WaitGroup
	for index, item := range chunks {
		workers.Add(1)
		go func() {
			defer workers.Done()
			select {
			case semaphore <- struct{}{}:
			case <-queryContext.Done():
				return
			}
			defer func() { <-semaphore }()
			items, err := h.history.QueryRange(queryContext, gameID, item.start, item.end)
			if err != nil {
				select {
				case errors <- err:
					cancel()
				default:
				}
				return
			}
			parts[index] = items
		}()
	}
	workers.Wait()
	select {
	case err := <-errors:
		return nil, err
	default:
	}

	result := make([]rankstore.Snapshot, 0)
	for _, items := range parts {
		result = append(result, items...)
	}
	return result, nil
}

func (h *Handler) revenueHistories(ctx context.Context) map[string][]revenue.Month {
	if h.revenue == nil {
		return nil
	}
	histories, err := h.revenue.List(ctx)
	if err != nil {
		h.logger.Error("query phase revenue history", "error", err)
		return nil
	}
	result := make(map[string][]revenue.Month, len(histories))
	for _, history := range histories {
		result[history.GameID] = history.History
	}
	return result
}

func (h *Handler) phaseRevenue(ctx context.Context, gameID string, start, end time.Time, histories map[string][]revenue.Month) any {
	if histories == nil {
		histories = h.revenueHistories(ctx)
	}
	months, ok := histories[gameID]
	if !ok {
		return nil
	}
	estimate := revenue.EstimateWindow(months, start.Format("2006-01-02"), end.Format("2006-01-02"))
	return map[string]any{
		"estimate": estimate.Estimate, "coverage": estimate.Coverage,
		"covered_hours": estimate.CoveredHours, "window_hours": estimate.WindowHours,
		"formula": estimate.Formula, "threshold": 1.0,
	}
}

func (h *Handler) bannerResponse(metrics bannerstats.Metrics, start, end time.Time, snapshots int, historyUsed bool, phaseRevenue any) map[string]any {
	source := "apple_public_feed"
	if historyUsed {
		source = "licensed_feed"
	}
	return map[string]any{
		"ranks":                 metrics.Ranks,
		"app_line_observations": metrics.AppLineObservations,
		"source":                source,
		"phase_revenue":         phaseRevenue,
		"coverage_status":       h.coverageStatus(start, end, snapshots),
		"collection_started_at": nullableTime(h.collectionStartedAt),
	}
}

func mergeSnapshots(older, newer []rankstore.Snapshot) []rankstore.Snapshot {
	byHour := make(map[int64]rankstore.Snapshot, len(older)+len(newer))
	for _, snapshot := range older {
		byHour[snapshot.ObservedHour.Unix()] = snapshot
	}
	for _, snapshot := range newer {
		byHour[snapshot.ObservedHour.Unix()] = snapshot
	}
	result := make([]rankstore.Snapshot, 0, len(byHour))
	for _, snapshot := range byHour {
		result = append(result, snapshot)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ObservedHour.Before(result[j].ObservedHour) })
	return result
}

func (h *Handler) coverageStatus(start, end time.Time, snapshots int) string {
	if snapshots > 0 {
		return "observed"
	}
	if !h.collectionStartedAt.IsZero() && !end.After(h.collectionStartedAt) {
		return "historical_provider_required"
	}
	if start.After(h.now().UTC()) {
		return "pending_collection"
	}
	return "collection_gap"
}

func nullableTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if status >= 200 && status < 300 {
		w.Header().Set("Cache-Control", "public, max-age=300, s-maxage=900, stale-if-error=3600")
	} else {
		w.Header().Set("Cache-Control", "no-store")
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
