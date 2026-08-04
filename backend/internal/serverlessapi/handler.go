package serverlessapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

var trackedGames = map[string]bool{"genshin": true, "hsr": true, "zzz": true, "wuwa": true, "endfield": true, "nte": true}

var appLineOrder = []string{"douyin", "tencent_video", "qq_music", "capcut_cn", "netease_music", "baidu_netdisk", "quark"}

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
	now                 func() time.Time
}

type Options struct {
	CollectionStartedAt time.Time
	History             HistoryReader
}

func New(reader Reader, fallback http.Handler, logger *slog.Logger, options Options) http.Handler {
	return &Handler{reader: reader, fallback: fallback, logger: logger, collectionStartedAt: options.CollectionStartedAt.UTC(), history: options.History, now: time.Now}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet && r.URL.Path == "/v1/banner-metrics" {
		h.bannerMetrics(w, r)
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
	if h.history != nil && (h.collectionStartedAt.IsZero() || start.Before(h.collectionStartedAt)) {
		historyEnd := end
		if !h.collectionStartedAt.IsZero() && h.collectionStartedAt.Before(historyEnd) {
			historyEnd = h.collectionStartedAt
		}
		if historyEnd.After(start) {
			historical, historyErr := h.history.QueryRange(r.Context(), gameID, start, historyEnd)
			if historyErr != nil {
				h.logger.Error("query licensed rank history", "error", historyErr)
			} else if len(historical) > 0 {
				snapshots = mergeSnapshots(historical, snapshots)
				historyUsed = true
			}
		}
	}

	ranks := make(map[string]any, 4)
	for _, market := range []string{"CN", "JP", "US", "KR"} {
		observed, ranked := 0, 0
		peak, lowest := 0, 0
		for _, snapshot := range snapshots {
			marketSnapshot, ok := snapshot.Markets[market]
			if !ok {
				continue
			}
			observed++
			rank, ok := marketSnapshot.Games[gameID]
			if !ok {
				continue
			}
			ranked++
			if peak == 0 || rank < peak {
				peak = rank
			}
			if rank > lowest {
				lowest = rank
			}
		}
		if observed == 0 {
			continue
		}
		ranks[market] = map[string]any{
			"peak_rank":             nullableRank(peak),
			"lowest_rank":           nullableRank(lowest),
			"observed_hours":        observed,
			"ranked_hours":          ranked,
			"lowest_is_beyond_feed": ranked < observed,
			"feed_limit":            100,
		}
	}

	lines := make([]map[string]any, 0, len(appLineOrder))
	for _, appID := range appLineOrder {
		hoursAbove, observed := 0, 0
		var updatedAt *time.Time
		for _, snapshot := range snapshots {
			cn, ok := snapshot.Markets["CN"]
			if !ok {
				continue
			}
			gameRank, gameOK := cn.Games[gameID]
			appRank, appOK := cn.AppLines[appID]
			// A single visible side is still conclusive: a visible game is
			// above an app outside Top 100, while a game outside Top 100 is
			// below a visible app. Only two missing sides are indeterminate.
			if !gameOK && !appOK {
				continue
			}
			observed++
			if gameOK && (!appOK || gameRank < appRank) {
				hoursAbove++
			}
			value := snapshot.ObservedHour
			updatedAt = &value
		}
		lines = append(lines, map[string]any{
			"app_id": appID, "hours_above": hoursAbove, "observed_hours": observed, "updated_at": updatedAt,
		})
	}

	status := h.coverageStatus(start, end, len(snapshots))
	source := "apple_public_feed"
	if historyUsed {
		source = "licensed_feed"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"ranks": ranks, "app_line_observations": lines, "source": source, "phase_revenue": nil,
			"coverage_status": status, "collection_started_at": nullableTime(h.collectionStartedAt),
		},
		"meta": map[string]any{"game_id": gameID, "start": start, "end": end, "snapshot_hours": len(snapshots)},
	})
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

func nullableRank(value int) any {
	if value == 0 {
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
