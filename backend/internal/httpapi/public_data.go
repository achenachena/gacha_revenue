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

var fixtureRevenueObservedAt = time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)

func (s *Server) publicRevenue(w http.ResponseWriter, r *http.Request) {
	publicRevenueCache.RLock()
	staleData, staleFetchedAt := publicRevenueCache.data, publicRevenueCache.fetchedAt
	if len(staleData) > 0 && time.Since(staleFetchedAt) < 6*time.Hour {
		publicRevenueCache.RUnlock()
		writePublicRevenue(w, staleData, staleFetchedAt, false)
		return
	}
	publicRevenueCache.RUnlock()

	client := &http.Client{
		Timeout:       20 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	type fetchResult struct {
		game publicRevenueGame
		err  error
	}
	results := make([]fetchResult, len(publicRevenueSources))
	var group sync.WaitGroup
	for index, source := range publicRevenueSources {
		group.Add(1)
		go func(index int, gameID, slug string) {
			defer group.Done()
			history, sourceURL, err := fetchPublicRevenue(r, client, slug)
			results[index] = fetchResult{game: publicRevenueGame{GameID: gameID, History: history, SourceURL: sourceURL}, err: err}
		}(index, source.GameID, source.Slug)
	}
	group.Wait()
	data := make([]publicRevenueGame, 0, len(results))
	for _, result := range results {
		if result.err != nil {
			s.logger.Warn("public revenue refresh failed", "game_id", result.game.GameID, "error", result.err)
			if len(staleData) > 0 {
				writePublicRevenue(w, staleData, staleFetchedAt, true)
			} else {
				writePublicRevenue(w, fixturePublicRevenue(), fixtureRevenueObservedAt, true)
			}
			return
		}
		data = append(data, result.game)
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
	body, err := io.ReadAll(io.LimitReader(response.Body, (8<<20)+1))
	if err != nil {
		return nil, sourceURL, err
	}
	if len(body) > 8<<20 {
		return nil, sourceURL, fmt.Errorf("source response exceeded 8 MiB")
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
