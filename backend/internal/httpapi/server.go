package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"time"

	"gacha-revenue/backend/internal/bannercalendar"
)

type Calendar interface {
	List(context.Context, string) ([]bannercalendar.Banner, error)
}

type Server struct {
	logger   *slog.Logger
	calendar Calendar
}

func New(logger *slog.Logger, calendar Calendar) http.Handler {
	server := &Server{logger: logger, calendar: calendar}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.health)
	mux.HandleFunc("GET /v1/games", server.games)
	mux.HandleFunc("GET /v1/public-revenue", server.publicRevenue)
	mux.HandleFunc("GET /v1/exchange-rate", server.exchangeRate)
	mux.HandleFunc("GET /v1/revenue", server.revenue)
	mux.HandleFunc("GET /v1/versions", server.versions)
	mux.HandleFunc("GET /v1/methodology", server.methodology)
	return server.recover(server.requestLog(mux))
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().UTC()})
}

func (s *Server) games(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"data": gameFixtures, "meta": responseMeta()})
}

func (s *Server) revenue(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	grain := r.URL.Query().Get("grain")
	if grain == "" {
		grain = "month"
	}
	if grain != "month" && grain != "year" && grain != "version" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid grain"})
		return
	}
	rows := make([]revenuePoint, 0)
	for _, point := range revenueFixtures {
		if (gameID == "" || point.GameID == gameID) && point.Grain == grain {
			rows = append(rows, point)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": responseMeta()})
}

func (s *Server) versions(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	if gameID != "" && !knownGame(gameID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid game_id"})
		return
	}
	rows := make([]versionFixture, 0, len(versionFixtures))
	for _, version := range versionFixtures {
		if gameID == "" || version.GameID == gameID {
			rows = append(rows, version)
		}
	}
	providerStatus := "not_configured"
	if s.calendar != nil {
		providerStatus = "connected"
		items, err := s.calendar.List(r.Context(), gameID)
		if err != nil {
			providerStatus = "temporarily_unavailable"
			s.logger.Warn("calendar provider refresh failed", "error", err)
		} else {
			byID := make(map[string]bool, len(rows))
			for _, row := range rows {
				byID[row.ID] = true
			}
			for _, item := range items {
				if !byID[item.ID] {
					rows = append(rows, calendarFixture(item))
				}
			}
		}
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].StartsAt > rows[j].StartsAt })
	meta := responseMeta()
	meta["calendar_provider"] = providerStatus
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": meta})
}

func (s *Server) methodology(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"version":  "3.0.0",
			"formula":  "mobile_iap = source_ios_android_ex_cn + source_ios_cn * (1 + 1.75)",
			"basis":    "third_party_mobile_iap_estimate",
			"excludes": []string{"advertising", "merchandise", "ip_licensing"},
		},
		"meta": responseMeta(),
	})
}

func (s *Server) requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(started).Milliseconds())
	})
}

func (s *Server) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("panic", "error", recovered)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func responseMeta() map[string]any {
	return map[string]any{
		"currency":            "USD",
		"unit":                "million",
		"basis":               "mobile_iap_ios_android_with_cn_android_1_75x",
		"data_status":         "public_source_snapshot_with_automatic_rank_observations",
		"methodology_version": "3.0.0",
	}
}

type gameFixture struct {
	ID         string   `json:"id"`
	NameZh     string   `json:"name_zh"`
	NameEn     string   `json:"name_en"`
	Publisher  string   `json:"publisher"`
	Platforms  []string `json:"platforms"`
	Confidence string   `json:"confidence"`
}

var gameFixtures = []gameFixture{
	{"genshin", "原神", "Genshin Impact", "HoYoverse", []string{"ios", "android", "pc", "playstation"}, "SOURCE"},
	{"hsr", "崩坏：星穹铁道", "Honkai: Star Rail", "HoYoverse", []string{"ios", "android", "pc", "playstation"}, "SOURCE"},
	{"zzz", "绝区零", "Zenless Zone Zero", "HoYoverse", []string{"ios", "android", "pc", "playstation", "xbox"}, "SOURCE"},
	{"wuwa", "鸣潮", "Wuthering Waves", "Kuro Games", []string{"ios", "android", "pc", "playstation"}, "SOURCE"},
	{"endfield", "明日方舟：终末地", "Arknights: Endfield", "GRYPHLINE", []string{"ios", "android", "pc", "playstation"}, "SOURCE"},
	{"nte", "异环", "Neverness to Everness", "Hotta Studio / Perfect World", []string{"ios", "android", "pc", "playstation"}, "SOURCE"},
}

func knownGame(gameID string) bool {
	for _, game := range gameFixtures {
		if game.ID == gameID {
			return true
		}
	}
	return false
}

type revenuePoint struct {
	GameID     string  `json:"game_id"`
	Grain      string  `json:"grain"`
	Period     string  `json:"period"`
	Estimate   float64 `json:"estimate"`
	Low        float64 `json:"p25"`
	High       float64 `json:"p75"`
	Confidence string  `json:"confidence"`
}

type modelRevenueSeries struct {
	GameID     string
	Confidence string
	Monthly    []float64
	Yearly     []float64
	Versions   []revenuePoint
}

var revenueFixtures = buildRevenueFixtures()

func buildRevenueFixtures() []revenuePoint {
	series := []modelRevenueSeries{
		{"genshin", "SOURCE", []float64{66.04, 55.245, 40.11, 40.105, 41.655, 33.34}, []float64{276.495}, nil},
		{"hsr", "SOURCE", []float64{8.0375, 21.135, 31.73, 58.1, 38.765, 28.455}, []float64{186.2225}, nil},
		{"zzz", "SOURCE", []float64{23.245, 13.35, 16.44, 7.167, 9.37, 9.655}, []float64{79.227}, nil},
		{"wuwa", "SOURCE", []float64{19.15, 46, 11.4, 14.7, 31.75, 34}, []float64{157}, nil},
		{"endfield", "SOURCE", []float64{28.55, 26.08, 22.05, 17.28, 4.766, 9.52}, []float64{108.246}, nil},
		{"nte", "SOURCE", []float64{0, 0, 0, 6.74, 23.575, 13.95}, []float64{44.265}, nil},
	}
	monthPeriods := []string{"2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"}
	yearPeriods := []string{"2026-01-01"}
	points := make([]revenuePoint, 0, 60)
	for _, game := range series {
		for index, estimate := range game.Monthly {
			if estimate > 0 {
				points = append(points, modelRevenuePoint(game.GameID, "month", monthPeriods[index], estimate, game.Confidence))
			}
		}
		for index, estimate := range game.Yearly {
			if estimate > 0 {
				points = append(points, modelRevenuePoint(game.GameID, "year", yearPeriods[index], estimate, game.Confidence))
			}
		}
		points = append(points, game.Versions...)
	}
	return points
}

func versionPoints(gameID, confidence string, values map[string]float64) []revenuePoint {
	points := make([]revenuePoint, 0, len(values))
	for period, estimate := range values {
		points = append(points, modelRevenuePoint(gameID, "version", period, estimate, confidence))
	}
	sort.Slice(points, func(i, j int) bool { return points[i].Period < points[j].Period })
	return points
}

func modelRevenuePoint(gameID, grain, period string, estimate float64, confidence string) revenuePoint {
	return revenuePoint{GameID: gameID, Grain: grain, Period: period, Estimate: estimate, Low: estimate, High: estimate, Confidence: confidence}
}

type versionFixture struct {
	ID           string                      `json:"id"`
	GameID       string                      `json:"game_id"`
	Version      string                      `json:"version"`
	PhaseIndex   int                         `json:"phase_index"`
	PhaseZh      string                      `json:"phase_zh"`
	PhaseEn      string                      `json:"phase_en"`
	CharactersZh string                      `json:"characters_zh"`
	CharactersEn string                      `json:"characters_en"`
	StartsAt     string                      `json:"starts_at"`
	EndsAt       string                      `json:"ends_at"`
	Estimate     *float64                    `json:"estimate"`
	P25          *float64                    `json:"p25"`
	P75          *float64                    `json:"p75"`
	Confidence   string                      `json:"confidence"`
	Ranks        map[string][2]*int          `json:"ios_grossing_rank_range"`
	AppHours     []fixtureAppLineObservation `json:"app_line_observations"`
	DataStatus   string                      `json:"data_status"`
	Source       string                      `json:"source"`
	SourceURL    string                      `json:"source_url"`
	SourceDate   string                      `json:"source_updated_at"`
}

type fixtureAppLineObservation struct {
	AppID      string     `json:"app_id"`
	NameZh     string     `json:"name_zh"`
	NameEn     string     `json:"name_en"`
	Hours      *float64   `json:"hours_above"`
	DataStatus string     `json:"data_status"`
	UpdatedAt  *time.Time `json:"updated_at"`
}

func number(value float64) *float64 { return &value }

var appLineFixtures = []fixtureAppLineObservation{
	{AppID: "douyin", NameZh: "抖音", NameEn: "Douyin", DataStatus: "awaiting_feed"},
	{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", DataStatus: "awaiting_feed"},
	{AppID: "qq_music", NameZh: "QQ音乐", NameEn: "QQ Music", DataStatus: "awaiting_feed"},
	{AppID: "capcut_cn", NameZh: "剪映", NameEn: "CapCut CN", DataStatus: "awaiting_feed"},
	{AppID: "netease_music", NameZh: "网易云音乐", NameEn: "NetEase Cloud Music", DataStatus: "awaiting_feed"},
	{AppID: "baidu_netdisk", NameZh: "百度网盘", NameEn: "Baidu Netdisk", DataStatus: "awaiting_feed"},
	{AppID: "quark", NameZh: "夸克网盘", NameEn: "Quark", DataStatus: "awaiting_feed"},
}

func calendarFixture(item bannercalendar.Banner) versionFixture {
	return versionFixture{
		ID: item.ID, GameID: item.GameID, Version: item.Version, PhaseIndex: item.PhaseIndex,
		PhaseZh: item.PhaseZh, PhaseEn: item.PhaseEn, CharactersZh: item.CharactersZh, CharactersEn: item.CharactersEn,
		StartsAt: item.StartsAt, EndsAt: item.EndsAt, Confidence: "N/A",
		Ranks:    map[string][2]*int{"CN": {nil, nil}, "JP": {nil, nil}, "US": {nil, nil}, "KR": {nil, nil}},
		AppHours: append([]fixtureAppLineObservation(nil), appLineFixtures...), DataStatus: "public_calendar",
		Source: "calendar_feed", SourceURL: item.SourceURL, SourceDate: item.SourceUpdatedAt,
	}
}

var versionFixtures = []versionFixture{
	{ID: "ww-24-cartethyia", GameID: "wuwa", Version: "2.4", PhaseIndex: 1, PhaseZh: "上半", PhaseEn: "Phase 1", CharactersZh: "卡提希娅", CharactersEn: "Cartethyia", StartsAt: "2025-06-12", EndsAt: "2025-07-03", Confidence: "N/A", Ranks: map[string][2]*int{}, AppHours: []fixtureAppLineObservation{{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", Hours: number(18), DataStatus: "verified_manual"}}, DataStatus: "verified_manual", Source: "product_owner_correction"},
	{ID: "ww-31-aemeath", GameID: "wuwa", Version: "3.1", PhaseIndex: 1, PhaseZh: "上半", PhaseEn: "Phase 1", CharactersZh: "爱弥斯", CharactersEn: "Aemeath", StartsAt: "2026-02-05", EndsAt: "2026-02-26", Confidence: "N/A", Ranks: map[string][2]*int{}, AppHours: []fixtureAppLineObservation{{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", Hours: number(15), DataStatus: "verified_manual"}}, DataStatus: "verified_manual", Source: "product_owner_correction"},
}
