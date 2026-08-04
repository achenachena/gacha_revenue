package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gacha-revenue/backend/internal/auth"
	"gacha-revenue/backend/internal/config"
)

type Server struct {
	config   config.Config
	verifier *auth.Verifier
	logger   *slog.Logger
	db       *pgxpool.Pool
}

func New(cfg config.Config, logger *slog.Logger) http.Handler {
	return NewWithDB(cfg, logger, nil)
}

func NewWithDB(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool) http.Handler {
	server := &Server{config: cfg, logger: logger, db: db}
	if cfg.CognitoIssuer != "" {
		server.verifier = auth.NewVerifier(cfg.CognitoIssuer, cfg.CognitoClientID)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.health)
	mux.HandleFunc("GET /v1/games", server.games)
	mux.HandleFunc("GET /v1/revenue", server.revenue)
	mux.HandleFunc("GET /v1/versions", server.versions)
	mux.HandleFunc("GET /v1/app-line-rankings", server.appLineRankings)
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
	if s.db != nil {
		s.revenueFromDB(w, r, gameID, grain)
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
	if s.db != nil {
		s.versionsFromDB(w, r, gameID)
		return
	}
	rows := make([]versionFixture, 0)
	for _, version := range versionFixtures {
		if gameID == "" || version.GameID == gameID {
			rows = append(rows, version)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": responseMeta()})
}

func (s *Server) appLineRankings(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	appLineID := r.URL.Query().Get("app_line_id")
	if gameID == "" || appLineID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game_id and app_line_id are required"})
		return
	}
	if s.db != nil {
		s.appLineRankingsFromDB(w, r, gameID, appLineID)
		return
	}
	type rankingRow struct {
		Rank       int     `json:"rank"`
		BannerID   string  `json:"banner_id"`
		Version    string  `json:"version"`
		Phase      string  `json:"phase"`
		Characters string  `json:"characters"`
		StartsAt   string  `json:"starts_at"`
		EndsAt     string  `json:"ends_at"`
		Hours      float64 `json:"hours_above"`
		DataStatus string  `json:"data_status"`
		Source     string  `json:"source"`
	}
	rows := make([]rankingRow, 0)
	for _, version := range versionFixtures {
		var hours *float64
		for _, observation := range version.AppHours {
			if observation.AppID == appLineID {
				hours = observation.Hours
				break
			}
		}
		if version.GameID != gameID || hours == nil {
			continue
		}
		rows = append(rows, rankingRow{BannerID: version.ID, Version: version.Version, Phase: version.PhaseZh, Characters: version.CharactersZh, StartsAt: version.StartsAt, EndsAt: version.EndsAt, Hours: *hours, DataStatus: version.DataStatus, Source: version.Source})
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Hours > rows[j].Hours })
	for index := range rows {
		rows[index].Rank = index + 1
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": responseMeta()})
}

func (s *Server) revenueFromDB(w http.ResponseWriter, r *http.Request, gameID, grain string) {
	allowed := map[string]bool{"day": true, "month": true, "year": true, "version": true, "banner": true}
	if !allowed[grain] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid grain"})
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT game_id, grain::text, to_char(period_start AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
		       (estimate_cny / 100000000.0)::float8,
		       (p25_cny / 100000000.0)::float8,
		       (p75_cny / 100000000.0)::float8,
		       replace(confidence::text, 'B_PLUS', 'B+')
		FROM revenue_estimates
		WHERE ($1 = '' OR game_id = $1) AND grain = $2::estimate_grain
		ORDER BY period_start`, gameID, grain)
	if err != nil {
		s.logger.Error("query revenue", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "revenue query failed"})
		return
	}
	defer rows.Close()
	data := make([]revenuePoint, 0)
	for rows.Next() {
		var point revenuePoint
		if err := rows.Scan(&point.GameID, &point.Grain, &point.Period, &point.Estimate, &point.Low, &point.High, &point.Confidence); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "revenue scan failed"})
			return
		}
		data = append(data, point)
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data, "meta": legacyRevenueMeta()})
}

type appLineAPI struct {
	AppID      string     `json:"app_id"`
	NameZh     string     `json:"name_zh"`
	NameEn     string     `json:"name_en"`
	Hours      *float64   `json:"hours_above"`
	DataStatus string     `json:"data_status"`
	UpdatedAt  *time.Time `json:"updated_at"`
}

type versionAPI struct {
	ID           string             `json:"id"`
	GameID       string             `json:"game_id"`
	Version      string             `json:"version"`
	PhaseZh      string             `json:"phase_zh"`
	PhaseEn      string             `json:"phase_en"`
	CharactersZh string             `json:"characters_zh"`
	CharactersEn string             `json:"characters_en"`
	StartsAt     time.Time          `json:"starts_at"`
	EndsAt       time.Time          `json:"ends_at"`
	Estimate     *float64           `json:"estimate"`
	P25          *float64           `json:"p25"`
	P75          *float64           `json:"p75"`
	Confidence   string             `json:"confidence"`
	DataStatus   string             `json:"data_status"`
	Ranks        map[string][2]*int `json:"ios_grossing_rank_range"`
	AppHours     []appLineAPI       `json:"app_line_observations"`
}

func (s *Server) versionsFromDB(w http.ResponseWriter, r *http.Request, gameID string) {
	rows, err := s.db.Query(r.Context(), `
		SELECT b.id::text, v.game_id, v.version,
		       coalesce(b.phase_zh, ''), coalesce(b.phase_en, ''),
		       b.name_zh, b.name_en, b.starts_at, b.ends_at, b.data_status
		FROM banners b
		JOIN game_versions v ON v.id = b.version_id
		WHERE ($1 = '' OR v.game_id = $1)
		ORDER BY b.starts_at DESC`, gameID)
	if err != nil {
		s.logger.Error("query banners", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "banner query failed"})
		return
	}
	defer rows.Close()
	data := make([]versionAPI, 0)
	for rows.Next() {
		var item versionAPI
		if err := rows.Scan(&item.ID, &item.GameID, &item.Version, &item.PhaseZh, &item.PhaseEn, &item.CharactersZh, &item.CharactersEn, &item.StartsAt, &item.EndsAt, &item.DataStatus); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "banner scan failed"})
			return
		}
		item.Confidence = "N/A"
		item.Ranks = map[string][2]*int{"CN": {nil, nil}, "JP": {nil, nil}, "US": {nil, nil}, "KR": {nil, nil}}
		rankRows, err := s.db.Query(r.Context(), `SELECT market, peak_rank, lowest_rank FROM banner_ios_rank_ranges WHERE banner_id=$1`, item.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank query failed"})
			return
		}
		for rankRows.Next() {
			var market string
			var peak, low int
			if err := rankRows.Scan(&market, &peak, &low); err != nil {
				rankRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rank scan failed"})
				return
			}
			item.Ranks[market] = [2]*int{&peak, &low}
		}
		rankRows.Close()

		appRows, err := s.db.Query(r.Context(), `
			SELECT a.id, a.name_zh, a.name_en, r.hours_above::float8,
			       coalesce(r.data_status, 'awaiting_feed'), r.data_updated_at
			FROM app_lines a
			LEFT JOIN banner_app_line_results r ON r.banner_id=$1 AND r.app_line_id=a.id
			ORDER BY CASE a.id
			  WHEN 'douyin' THEN 1 WHEN 'tencent_video' THEN 2 WHEN 'qq_music' THEN 3
			  WHEN 'capcut_cn' THEN 4 WHEN 'netease_music' THEN 5
			  WHEN 'baidu_netdisk' THEN 6 ELSE 7 END`, item.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app-line query failed"})
			return
		}
		for appRows.Next() {
			var line appLineAPI
			if err := appRows.Scan(&line.AppID, &line.NameZh, &line.NameEn, &line.Hours, &line.DataStatus, &line.UpdatedAt); err != nil {
				appRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app-line scan failed"})
				return
			}
			item.AppHours = append(item.AppHours, line)
		}
		appRows.Close()
		data = append(data, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data, "meta": responseMeta()})
}

func (s *Server) appLineRankingsFromDB(w http.ResponseWriter, r *http.Request, gameID, appLineID string) {
	rows, err := s.db.Query(r.Context(), `
		SELECT b.id::text, v.version, coalesce(b.phase_zh, ''), b.name_zh,
		       b.starts_at, b.ends_at, result.hours_above::float8,
		       result.data_status, coalesce(result.source_note, '')
		FROM banner_app_line_results result
		JOIN banners b ON b.id=result.banner_id
		JOIN game_versions v ON v.id=b.version_id
		WHERE v.game_id=$1 AND result.app_line_id=$2
		ORDER BY result.hours_above DESC, b.starts_at DESC`, gameID, appLineID)
	if err != nil {
		s.logger.Error("query app-line ranking", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "ranking query failed"})
		return
	}
	defer rows.Close()
	type row struct {
		Rank       int       `json:"rank"`
		BannerID   string    `json:"banner_id"`
		Version    string    `json:"version"`
		Phase      string    `json:"phase"`
		Characters string    `json:"characters"`
		StartsAt   time.Time `json:"starts_at"`
		EndsAt     time.Time `json:"ends_at"`
		Hours      float64   `json:"hours_above"`
		DataStatus string    `json:"data_status"`
		Source     string    `json:"source"`
	}
	data := make([]row, 0)
	for rows.Next() {
		var item row
		if err := rows.Scan(&item.BannerID, &item.Version, &item.Phase, &item.Characters, &item.StartsAt, &item.EndsAt, &item.Hours, &item.DataStatus, &item.Source); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "ranking scan failed"})
			return
		}
		item.Rank = len(data) + 1
		data = append(data, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data, "meta": responseMeta()})
}

func (s *Server) methodology(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"version":  "2.0.0",
			"formula":  "(licensed_store_baseline + china_android_multiplier * china_ios) * (1 + non_mobile_completion)",
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
		"currency":            "USD",
		"unit":                "million",
		"basis":               "mobile_iap_ios_android_with_cn_android_1_75x",
		"data_status":         "public_source_snapshot_with_automatic_rank_observations",
		"methodology_version": "3.0.0",
	}
}

// The original PostgreSQL schema stores estimates in CNY. Keep that legacy
// endpoint correctly labelled instead of presenting those rows as the newer
// public USD source used by the fixture/site API.
func legacyRevenueMeta() map[string]any {
	return map[string]any{
		"currency":            "CNY",
		"unit":                "hundred_million",
		"basis":               "legacy_postgresql_model",
		"data_status":         "licensed_feed_or_model_output",
		"methodology_version": "2.0.0",
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

var versionFixtures = []versionFixture{
	{ID: "ww-24-cartethyia", GameID: "wuwa", Version: "2.4", PhaseZh: "卡提希娅卡池", PhaseEn: "Cartethyia banner", CharactersZh: "卡提希娅", CharactersEn: "Cartethyia", StartsAt: "2025-06-12", EndsAt: "2025-07-03", Confidence: "N/A", Ranks: map[string][2]*int{}, AppHours: []fixtureAppLineObservation{{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", Hours: number(18), DataStatus: "verified_manual"}}, DataStatus: "verified_manual", Source: "product_owner_correction"},
	{ID: "ww-31-aemeath", GameID: "wuwa", Version: "3.1", PhaseZh: "爱弥斯卡池", PhaseEn: "Aemeath banner", CharactersZh: "爱弥斯", CharactersEn: "Aemeath", StartsAt: "2026-02-05", EndsAt: "2026-02-26", Confidence: "N/A", Ranks: map[string][2]*int{}, AppHours: []fixtureAppLineObservation{{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", Hours: number(15), DataStatus: "verified_manual"}}, DataStatus: "verified_manual", Source: "product_owner_correction"},
	{ID: "hsr-32-anaxa", GameID: "hsr", Version: "3.2", PhaseZh: "下半卡池", PhaseEn: "Phase 2 banner", CharactersZh: "那刻夏", CharactersEn: "Anaxa", StartsAt: "2025-04-30", EndsAt: "2025-05-20", Confidence: "N/A", Ranks: map[string][2]*int{}, AppHours: []fixtureAppLineObservation{{AppID: "douyin", NameZh: "抖音", NameEn: "Douyin", Hours: number(0), DataStatus: "verified_manual"}}, DataStatus: "verified_manual", Source: "product_owner_correction"},
}
