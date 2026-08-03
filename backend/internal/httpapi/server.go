package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"gacha-revenue/backend/internal/auth"
	"gacha-revenue/backend/internal/config"
)

type Server struct {
	config   config.Config
	verifier *auth.Verifier
	logger   *slog.Logger
}

func New(cfg config.Config, logger *slog.Logger) http.Handler {
	server := &Server{config: cfg, logger: logger}
	if cfg.CognitoIssuer != "" {
		server.verifier = auth.NewVerifier(cfg.CognitoIssuer, cfg.CognitoClientID)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.health)
	mux.HandleFunc("GET /v1/games", server.games)
	mux.HandleFunc("GET /v1/revenue", server.revenue)
	mux.HandleFunc("GET /v1/versions", server.versions)
	mux.HandleFunc("GET /v1/methodology", server.methodology)
	mux.Handle("POST /v1/admin/ingestions", server.requireRole("editor", http.HandlerFunc(server.createIngestion)))
	return server.recover(server.requestLog(server.cors(server.authenticate(mux))))
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
	rows := make([]versionFixture, 0)
	for _, version := range versionFixtures {
		if gameID == "" || version.GameID == gameID {
			rows = append(rows, version)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": responseMeta()})
}

func (s *Server) methodology(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"version":  "1.4.0",
			"formula":  "store_iap_baseline * region_factor * platform_completion * fx_rate",
			"basis":    "gross_bookings_before_platform_fees",
			"excludes": []string{"advertising", "merchandise", "ip_licensing"},
		},
		"meta": responseMeta(),
	})
}

func (s *Server) createIngestion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusAccepted, map[string]any{"status": "queued", "requested_at": time.Now().UTC()})
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.verifier == nil {
			next.ServeHTTP(w, r.WithContext(auth.WithClaims(r.Context(), auth.Claims{Role: "viewer"})))
			return
		}
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			if s.config.AuthRequired {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing bearer token"})
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithClaims(r.Context(), auth.Claims{Role: "viewer"})))
			return
		}
		claims, err := s.verifier.Verify(r.Context(), strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid bearer token"})
			return
		}
		next.ServeHTTP(w, r.WithContext(auth.WithClaims(r.Context(), claims)))
	})
}

func (s *Server) requireRole(minimum string, next http.Handler) http.Handler {
	weight := map[string]int{"viewer": 1, "editor": 2, "admin": 3}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if weight[auth.FromContext(r.Context()).Role] < weight[minimum] {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient role"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
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
		"currency":            "CNY",
		"unit":                "100_million",
		"basis":               "estimated_gross_bookings",
		"data_status":         "demo_snapshot",
		"methodology_version": "1.4.0",
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
	{"genshin", "原神", "Genshin Impact", "HoYoverse", []string{"ios", "android", "pc", "playstation"}, "A"},
	{"hsr", "崩坏：星穹铁道", "Honkai: Star Rail", "HoYoverse", []string{"ios", "android", "pc", "playstation"}, "A"},
	{"zzz", "绝区零", "Zenless Zone Zero", "HoYoverse", []string{"ios", "android", "pc", "playstation", "xbox"}, "A"},
	{"wuwa", "鸣潮", "Wuthering Waves", "Kuro Games", []string{"ios", "android", "pc", "playstation"}, "B+"},
	{"endfield", "明日方舟：终末地", "Arknights: Endfield", "GRYPHLINE", []string{"ios", "android", "pc", "playstation"}, "B"},
	{"ananta", "异环", "ANANTA", "NetEase Games", []string{"ios", "android", "pc", "playstation"}, "N/A"},
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

var revenueFixtures = []revenuePoint{
	{"genshin", "month", "2026-07", 2.36, 2.04, 2.71, "A"},
	{"hsr", "month", "2026-07", 2.98, 2.61, 3.42, "A"},
	{"zzz", "month", "2026-07", 1.42, 1.21, 1.67, "A"},
	{"wuwa", "month", "2026-07", 1.89, 1.53, 2.31, "B+"},
	{"endfield", "month", "2026-07", 1.64, 1.22, 2.14, "B"},
	{"genshin", "year", "2026", 18.9, 16.7, 21.4, "A"},
	{"hsr", "year", "2026", 21.4, 18.8, 24.1, "A"},
	{"zzz", "year", "2026", 10.8, 9.3, 12.5, "A"},
	{"wuwa", "year", "2026", 13.7, 11.2, 16.6, "B+"},
	{"endfield", "year", "2026", 7.2, 5.5, 9.4, "B"},
}

type versionFixture struct {
	ID         string                 `json:"id"`
	GameID     string                 `json:"game_id"`
	Version    string                 `json:"version"`
	Characters string                 `json:"characters"`
	Estimate   *float64               `json:"estimate"`
	Ranks      map[string][2]int      `json:"ios_grossing_rank_range"`
	AppHours   map[string]float64     `json:"cn_app_line_hours"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

func number(value float64) *float64 { return &value }

var versionFixtures = []versionFixture{
	{"gi-57", "genshin", "5.7", "丝柯克 · 塔利雅", number(6.12), map[string][2]int{"CN": {1, 38}, "JP": {1, 26}, "US": {3, 44}, "KR": {2, 35}}, map[string]float64{"douyin": 18.4, "tencent_video": 46.3, "qq_music": 72}, nil},
	{"hsr-32", "hsr", "3.2", "遐蝶 · 那刻夏", number(6.72), map[string][2]int{"CN": {1, 31}, "JP": {1, 19}, "US": {2, 35}, "KR": {1, 27}}, map[string]float64{"douyin": 20.6, "tencent_video": 51.9, "qq_music": 80.6}, nil},
	{"zzz-20", "zzz", "2.0", "仪玄 · 橘福福", number(4.36), map[string][2]int{"CN": {2, 47}, "JP": {2, 34}, "US": {7, 62}, "KR": {4, 51}}, map[string]float64{"douyin": 12.5, "tencent_video": 31.5, "qq_music": 49}, nil},
	{"ww-24", "wuwa", "2.4", "卡提希娅 · 露帕", number(5.12), map[string][2]int{"CN": {2, 42}, "JP": {1, 31}, "US": {5, 56}, "KR": {3, 48}}, map[string]float64{"douyin": 15.1, "tencent_video": 38, "qq_music": 59}, nil},
}
