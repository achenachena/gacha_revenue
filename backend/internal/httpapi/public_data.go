package httpapi

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type publicRevenueMonth struct {
	Year  int     `json:"year"`
	Month int     `json:"month"`
	Value float64 `json:"value"`
}

type publicRevenueGame struct {
	GameID    string               `json:"game_id"`
	History   []publicRevenueMonth `json:"history"`
	SourceURL string               `json:"source_url"`
}

var publicRevenueSources = []struct {
	GameID string
	Slug   string
}{
	{"genshin", "genshin-impact"},
	{"hsr", "honkai-star-rail"},
	{"zzz", "zenless-zone-zero"},
	{"wuwa", "wuthering-waves"},
	{"endfield", "arknights-endfield"},
	{"nte", "neverness-to-everness"},
}

var revenueHistoryPattern = regexp.MustCompile(`\\"year\\":(\d{4}),\\"month\\":(\d+),\\"revenue_total\\":(\d+)`)

var publicRevenueCache struct {
	sync.RWMutex
	data      []publicRevenueGame
	fetchedAt time.Time
}

func (s *Server) publicRevenue(w http.ResponseWriter, r *http.Request) {
	publicRevenueCache.RLock()
	if len(publicRevenueCache.data) > 0 && time.Since(publicRevenueCache.fetchedAt) < 6*time.Hour {
		data, fetchedAt := publicRevenueCache.data, publicRevenueCache.fetchedAt
		publicRevenueCache.RUnlock()
		writePublicRevenue(w, data, fetchedAt, false)
		return
	}
	publicRevenueCache.RUnlock()

	client := &http.Client{Timeout: 20 * time.Second}
	data := make([]publicRevenueGame, 0, len(publicRevenueSources))
	for _, source := range publicRevenueSources {
		history, sourceURL, err := fetchPublicRevenue(r, client, source.Slug)
		if err != nil {
			s.logger.Warn("public revenue refresh failed", "game_id", source.GameID, "error", err)
			writePublicRevenue(w, fixturePublicRevenue(), time.Now().UTC(), true)
			return
		}
		data = append(data, publicRevenueGame{GameID: source.GameID, History: history, SourceURL: sourceURL})
	}
	fetchedAt := time.Now().UTC()
	publicRevenueCache.Lock()
	publicRevenueCache.data, publicRevenueCache.fetchedAt = data, fetchedAt
	publicRevenueCache.Unlock()
	writePublicRevenue(w, data, fetchedAt, false)
}

func fetchPublicRevenue(r *http.Request, client *http.Client, slug string) ([]publicRevenueMonth, string, error) {
	sourceURL := "https://www.gachadash.com/game/" + slug
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, sourceURL, err
	}
	request.Header.Set("User-Agent", "gacha-revenue-observatory/1.0")
	response, err := client.Do(request)
	if err != nil {
		return nil, sourceURL, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, sourceURL, fmt.Errorf("source returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return nil, sourceURL, err
	}
	history, err := parsePublicRevenueSource(string(body))
	return history, sourceURL, err
}

func parsePublicRevenueSource(text string) ([]publicRevenueMonth, error) {
	start := strings.Index(text, `\"revenueHistory\":[`)
	if start < 0 {
		return nil, fmt.Errorf("revenue history not found")
	}
	finish := strings.Index(text[start:], "]")
	if finish < 0 {
		return nil, fmt.Errorf("revenue history was truncated")
	}
	history := make([]publicRevenueMonth, 0, 12)
	for _, match := range revenueHistoryPattern.FindAllStringSubmatch(text[start:start+finish+1], -1) {
		year, _ := strconv.Atoi(match[1])
		month, _ := strconv.Atoi(match[2])
		total, _ := strconv.ParseFloat(match[3], 64)
		history = append(history, publicRevenueMonth{Year: year, Month: month, Value: total / 100_000_000})
	}
	if len(history) == 0 {
		return nil, fmt.Errorf("revenue history was empty")
	}
	return history, nil
}

func fixturePublicRevenue() []publicRevenueGame {
	data := make([]publicRevenueGame, 0, len(publicRevenueSources))
	for _, source := range publicRevenueSources {
		history := make([]publicRevenueMonth, 0, 6)
		for _, point := range revenueFixtures {
			if point.GameID != source.GameID || point.Grain != "month" {
				continue
			}
			period, err := time.Parse("2006-01-02", point.Period)
			if err == nil {
				history = append(history, publicRevenueMonth{Year: period.Year(), Month: int(period.Month()), Value: point.Estimate})
			}
		}
		data = append(data, publicRevenueGame{GameID: source.GameID, History: history, SourceURL: "https://www.gachadash.com/revenue"})
	}
	return data
}

func writePublicRevenue(w http.ResponseWriter, data []publicRevenueGame, fetchedAt time.Time, fallback bool) {
	w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=21600")
	writeJSON(w, http.StatusOK, map[string]any{
		"data": data,
		"meta": map[string]any{
			"currency":                 "USD",
			"unit":                     "million",
			"basis":                    "mobile_iap_ios_android",
			"provider":                 "Sensor Tower via GachaRevenue / GachaDash",
			"china_android_multiplier": 1.75,
			"fetched_at":               fetchedAt,
			"fallback_snapshot":        fallback,
		},
	})
}

func (s *Server) bannerMetrics(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "rank database is unavailable"})
		return
	}
	gameID := r.URL.Query().Get("game_id")
	start, startErr := time.Parse("2006-01-02", r.URL.Query().Get("start"))
	end, endErr := time.Parse("2006-01-02", r.URL.Query().Get("end"))
	if gameID == "" || startErr != nil || endErr != nil || !end.After(start) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid game_id, start and end are required"})
		return
	}

	rankRows, err := s.db.Query(r.Context(), `
		WITH preferred AS (
		  SELECT market, observed_hour, grossing_rank,
		         row_number() OVER (
		           PARTITION BY market, observed_hour
		           ORDER BY CASE source WHEN 'authorized_rank_feed' THEN 1 WHEN 'apple_public_feed' THEN 2 ELSE 3 END
		         ) AS precedence
		  FROM ios_hourly_rank_snapshots
		  WHERE subject_type='game' AND subject_id=$1 AND observed_hour >= $2 AND observed_hour < $3
		)
		SELECT market, min(grossing_rank), max(grossing_rank), count(*)
		FROM preferred WHERE precedence=1
		GROUP BY market ORDER BY market`, gameID, start, end)
	if err != nil {
		s.logger.Error("query banner metrics ranks", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank query failed"})
		return
	}
	ranks := map[string]any{}
	for rankRows.Next() {
		var market string
		var peak, lowest, observed int
		if err := rankRows.Scan(&market, &peak, &lowest, &observed); err != nil {
			rankRows.Close()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank scan failed"})
			return
		}
		ranks[market] = map[string]any{"peak_rank": peak, "lowest_rank": lowest, "observed_hours": observed, "ranked_hours": observed, "lowest_is_beyond_200": false}
	}
	rankRows.Close()

	lineRows, err := s.db.Query(r.Context(), `
		WITH paired AS (
		  SELECT a.id, game_rank.observed_hour,
		         game_rank.grossing_rank AS game_rank,
		         app_rank.grossing_rank AS app_rank,
		         row_number() OVER (
		           PARTITION BY a.id, game_rank.observed_hour
		           ORDER BY CASE game_rank.source WHEN 'authorized_rank_feed' THEN 1 WHEN 'apple_public_feed' THEN 2 ELSE 3 END
		         ) AS precedence
		  FROM app_lines a
		  JOIN ios_hourly_rank_snapshots game_rank
		    ON game_rank.subject_type='game' AND game_rank.subject_id=$1 AND game_rank.market='CN'
		   AND game_rank.observed_hour >= $2 AND game_rank.observed_hour < $3
		  JOIN ios_hourly_rank_snapshots app_rank
		    ON app_rank.subject_type='app_line' AND app_rank.subject_id=a.id AND app_rank.market='CN'
		   AND app_rank.observed_hour=game_rank.observed_hour AND app_rank.source=game_rank.source
		)
		SELECT a.id,
		       count(*) FILTER (WHERE paired.game_rank < paired.app_rank),
		       count(paired.observed_hour), max(paired.observed_hour)
		FROM app_lines a
		LEFT JOIN paired ON paired.id=a.id AND paired.precedence=1
		GROUP BY a.id ORDER BY a.id`, gameID, start, end)
	if err != nil {
		s.logger.Error("query banner metrics app lines", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app-line query failed"})
		return
	}
	lines := make([]map[string]any, 0, 7)
	for lineRows.Next() {
		var appID string
		var hours, observed int
		var updatedAt *time.Time
		if err := lineRows.Scan(&appID, &hours, &observed, &updatedAt); err != nil {
			lineRows.Close()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app-line scan failed"})
			return
		}
		lines = append(lines, map[string]any{"app_id": appID, "hours_above": hours, "observed_hours": observed, "updated_at": updatedAt})
	}
	lineRows.Close()
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"ranks": ranks, "app_line_observations": lines, "source": "apple_public_feed", "phase_revenue": nil}, "meta": map[string]any{"game_id": gameID, "start": start, "end": end}})
}
