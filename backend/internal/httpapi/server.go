package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"time"

	"gacha-revenue/backend/internal/bannercalendar"
	"gacha-revenue/backend/internal/revenue"
	"gacha-revenue/backend/internal/versioncatalog"
)

type Calendar interface {
	List(context.Context, string) ([]bannercalendar.Banner, error)
}

type Server struct {
	logger        *slog.Logger
	calendar      Calendar
	revenueReader RevenueReader
}

func New(logger *slog.Logger, calendar Calendar) http.Handler {
	return NewWithOptions(logger, calendar, Options{})
}

type Options struct {
	Revenue RevenueReader
}

func NewWithOptions(logger *slog.Logger, calendar Calendar, options Options) http.Handler {
	server := &Server{logger: logger, calendar: calendar, revenueReader: options.Revenue}

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
	writeJSON(w, http.StatusOK, map[string]any{"data": revenue.Definitions, "meta": responseMeta()})
}

func (s *Server) revenue(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("game_id")
	if gameID != "" && !knownGame(gameID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid game_id"})
		return
	}
	grain := r.URL.Query().Get("grain")
	if grain == "" {
		grain = "month"
	}
	if grain != "month" && grain != "year" && grain != "version" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid grain"})
		return
	}
	histories, _ := s.revenueHistories(r.Context())
	period := revenue.LatestPeriod(histories)
	rows := make([]revenuePoint, 0)
	for _, history := range histories {
		if gameID != "" && history.GameID != gameID {
			continue
		}
		if grain == "month" {
			for _, month := range history.History {
				rows = append(rows, revenuePoint{GameID: history.GameID, Grain: grain, Period: time.Date(month.Year, time.Month(month.Month), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02"), Estimate: month.Value, Confidence: "SOURCE"})
			}
			continue
		}
		if grain == "year" {
			definition, _ := revenue.Definition(history.GameID)
			for _, annual := range revenue.Summarize(definition, history, period).Yearly {
				rows = append(rows, revenuePoint{GameID: history.GameID, Grain: grain, Period: time.Date(annual.Year, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02"), Estimate: annual.Value, Confidence: "SOURCE"})
			}
			continue
		}
		for _, version := range versionFixtures {
			if version.GameID != history.GameID {
				continue
			}
			estimate := revenue.EstimateWindow(history.History, version.StartsAt, version.EndsAt)
			if estimate.Estimate == nil {
				continue
			}
			rows = append(rows, revenuePoint{GameID: history.GameID, Grain: grain, Period: version.StartsAt, Estimate: *estimate.Estimate, Confidence: "MODEL"})
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
	histories, _ := s.revenueHistories(r.Context())
	historyByGame := make(map[string][]revenue.Month, len(histories))
	for _, history := range histories {
		historyByGame[history.GameID] = history.History
	}
	for index := range rows {
		estimate := revenue.EstimateWindow(historyByGame[rows[index].GameID], rows[index].StartsAt, rows[index].EndsAt)
		rows[index].Estimate = estimate.Estimate
		rows[index].P25 = nil
		rows[index].P75 = nil
		rows[index].RevenueCoverage = estimate.Coverage
		rows[index].RevenueCoveredHours = estimate.CoveredHours
		rows[index].WindowHours = estimate.WindowHours
		rows[index].RevenueFormula = estimate.Formula
		if estimate.Estimate != nil {
			rows[index].Confidence = "MODEL"
		}
	}
	meta := responseMeta()
	meta["calendar_provider"] = providerStatus
	writeJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": meta})
}

func (s *Server) methodology(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"data": revenue.Methodology(),
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
		"currency":            revenue.Currency,
		"unit":                revenue.Unit,
		"basis":               revenue.Basis,
		"data_status":         "public_source_snapshot_with_automatic_rank_observations",
		"methodology_version": revenue.MethodologyVersion,
	}
}

func knownGame(gameID string) bool {
	for _, game := range revenue.Definitions {
		if game.ID == gameID {
			return true
		}
	}
	return false
}

type revenuePoint struct {
	GameID     string   `json:"game_id"`
	Grain      string   `json:"grain"`
	Period     string   `json:"period"`
	Estimate   float64  `json:"estimate"`
	Low        *float64 `json:"p25"`
	High       *float64 `json:"p75"`
	Confidence string   `json:"confidence"`
}

type versionFixture = versioncatalog.Version
type fixtureAppLineObservation = versioncatalog.AppLineObservation

var appLineFixtures = versioncatalog.DefaultAppLines()

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

var versionFixtures = versioncatalog.List()
