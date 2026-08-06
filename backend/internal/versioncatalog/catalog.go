package versioncatalog

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

type Version struct {
	ID                    string               `json:"id"`
	GameID                string               `json:"game_id"`
	Version               string               `json:"version"`
	PhaseIndex            int                  `json:"phase_index"`
	PhaseZh               string               `json:"phase_zh"`
	PhaseEn               string               `json:"phase_en"`
	CharactersZh          string               `json:"characters_zh"`
	CharactersEn          string               `json:"characters_en"`
	StartsAt              string               `json:"starts_at"`
	EndsAt                string               `json:"ends_at"`
	Estimate              *float64             `json:"estimate"`
	P25                   *float64             `json:"p25"`
	P75                   *float64             `json:"p75"`
	Confidence            string               `json:"confidence"`
	RevenueCoverage       float64              `json:"revenue_coverage"`
	RevenueCoveredHours   int                  `json:"revenue_covered_hours"`
	WindowHours           int                  `json:"window_hours"`
	RevenueFormula        string               `json:"revenue_formula"`
	RevenueMarketCoverage string               `json:"revenue_market_coverage,omitempty"`
	RevenueScope          string               `json:"revenue_scope,omitempty"`
	CoverageStatus        string               `json:"coverage_status"`
	ObservedHours         int                  `json:"observed_hours"`
	CollectionStartedAt   *string              `json:"collection_started_at"`
	Ranks                 map[string][2]*int   `json:"ios_grossing_rank_range"`
	RankEvidence          *MetricEvidence      `json:"rank_evidence"`
	AppHours              []AppLineObservation `json:"app_line_observations"`
	DataStatus            string               `json:"data_status"`
	Source                string               `json:"source"`
	SourceURL             string               `json:"source_url"`
	SourceDate            string               `json:"source_updated_at"`
}

type AppLineObservation struct {
	AppID      string          `json:"app_id"`
	NameZh     string          `json:"name_zh"`
	NameEn     string          `json:"name_en"`
	Hours      *float64        `json:"hours_above"`
	DataStatus string          `json:"data_status"`
	UpdatedAt  *string         `json:"updated_at"`
	Evidence   *MetricEvidence `json:"evidence"`
}

type MetricEvidence struct {
	PrimaryURL    string `json:"primary_url"`
	CrossCheckURL string `json:"cross_check_url"`
	NoteZh        string `json:"note_zh"`
	NoteEn        string `json:"note_en"`
}

// historicalObservation keeps sourced ranking facts separate from the banner
// calendar and revenue estimates. The ID references an owner-controlled catalog
// row; only fields backed by the attached evidence are overlaid.
type historicalObservation struct {
	ID           string               `json:"id"`
	Ranks        map[string][2]*int   `json:"ios_grossing_rank_range"`
	RankEvidence *MetricEvidence      `json:"rank_evidence"`
	AppHours     []AppLineObservation `json:"app_line_observations"`
}

var defaultAppLines = []AppLineObservation{
	{AppID: "douyin", NameZh: "抖音", NameEn: "Douyin", DataStatus: "awaiting_feed"},
	{AppID: "tencent_video", NameZh: "腾讯视频", NameEn: "Tencent Video", DataStatus: "awaiting_feed"},
	{AppID: "qq_music", NameZh: "QQ音乐", NameEn: "QQ Music", DataStatus: "awaiting_feed"},
	{AppID: "capcut_cn", NameZh: "剪映", NameEn: "CapCut CN", DataStatus: "awaiting_feed"},
	{AppID: "netease_music", NameZh: "网易云音乐", NameEn: "NetEase Cloud Music", DataStatus: "awaiting_feed"},
	{AppID: "baidu_netdisk", NameZh: "百度网盘", NameEn: "Baidu Netdisk", DataStatus: "awaiting_feed"},
	{AppID: "quark", NameZh: "夸克网盘", NameEn: "Quark", DataStatus: "awaiting_feed"},
}

//go:embed catalog.json
var catalogJSON []byte

//go:embed historical_observations.json
var historicalObservationsJSON []byte

var chineseNameCorrections = strings.NewReplacer(
	"迷迷", "万敌",
	"•", "·",
	"秧秧·霜伶", "秧秧·玄翎",
	"岁岁", "穗穗",
	"卢克·赫尔森", "陆·赫斯",
	"西格莉塔", "西格莉卡",
	"绯优", "绯雪",
	"德妮雅", "达妮娅",
	"露西拉", "洛瑟菈",
)

var englishNameCorrections = strings.NewReplacer(
	"Myday", "Mydei",
)

var catalog = load()

func List() []Version {
	result := make([]Version, len(catalog))
	for index, version := range catalog {
		result[index] = clone(version)
	}
	return result
}

func DefaultAppLines() []AppLineObservation {
	return append([]AppLineObservation(nil), defaultAppLines...)
}

// Merge enriches the embedded owner-controlled catalog with a provider feed.
// Owner corrections and observations remain authoritative; provider rows may
// update calendar/character metadata and add previously unseen phases.
func Merge(base, updates []Version) []Version {
	result := make([]Version, len(base))
	byID := make(map[string]int, len(base))
	byPhase := make(map[string]int, len(base))
	for index, version := range base {
		result[index] = clone(version)
		byID[version.ID] = index
		byPhase[phaseKey(version)] = index
	}
	for _, update := range updates {
		index, exists := byID[update.ID]
		if !exists {
			index, exists = byPhase[phaseKey(update)]
		}
		if !exists {
			result = append(result, clone(update))
			byID[update.ID] = len(result) - 1
			byPhase[phaseKey(update)] = len(result) - 1
			continue
		}
		enrichCalendar(&result[index], update)
	}
	return result
}

func phaseKey(version Version) string {
	return fmt.Sprintf("%s:%s:%d", version.GameID, version.Version, version.PhaseIndex)
}

func enrichCalendar(target *Version, update Version) {
	if update.PhaseZh != "" {
		target.PhaseZh = update.PhaseZh
	}
	if update.PhaseEn != "" {
		target.PhaseEn = update.PhaseEn
	}
	if update.CharactersZh != "" {
		target.CharactersZh = update.CharactersZh
	}
	if update.CharactersEn != "" {
		target.CharactersEn = update.CharactersEn
	}
	if update.StartsAt != "" {
		target.StartsAt = update.StartsAt
	}
	if update.EndsAt != "" {
		target.EndsAt = update.EndsAt
	}
	if update.Source != "" {
		target.Source = update.Source
	}
	if update.SourceURL != "" {
		target.SourceURL = update.SourceURL
	}
	if update.SourceDate != "" {
		target.SourceDate = update.SourceDate
	}
	if update.DataStatus != "" {
		target.DataStatus = update.DataStatus
	}
	normalizeLocalizedNames(target)
}

func load() []Version {
	var versions []Version
	if err := json.Unmarshal(catalogJSON, &versions); err != nil {
		panic("invalid embedded version catalog: " + err.Error())
	}
	applyHistoricalObservations(versions)
	for index := range versions {
		normalizeLocalizedNames(&versions[index])
		if versions[index].Confidence == "" {
			versions[index].Confidence = "N/A"
		}
		if versions[index].Ranks == nil {
			versions[index].Ranks = make(map[string][2]*int)
		}
		for _, market := range []string{"CN", "JP", "US", "KR"} {
			if _, ok := versions[index].Ranks[market]; !ok {
				versions[index].Ranks[market] = [2]*int{nil, nil}
			}
		}
		known := make(map[string]AppLineObservation, len(versions[index].AppHours))
		for _, observation := range versions[index].AppHours {
			known[observation.AppID] = observation
		}
		observations := make([]AppLineObservation, 0, len(defaultAppLines))
		for _, fallback := range defaultAppLines {
			observation, ok := known[fallback.AppID]
			if !ok {
				observation = fallback
			}
			observation.NameZh, observation.NameEn = fallback.NameZh, fallback.NameEn
			if observation.DataStatus == "" {
				observation.DataStatus = "awaiting_feed"
			}
			observations = append(observations, observation)
		}
		versions[index].AppHours = observations
		if versions[index].RankEvidence != nil {
			versions[index].CoverageStatus = "verified_historical_summary"
		}
		for _, observation := range observations {
			if observation.Hours != nil || observation.Evidence != nil {
				versions[index].CoverageStatus = "verified_historical_summary"
			}
		}
		if versions[index].CoverageStatus == "" {
			if versions[index].StartsAt == "" || versions[index].EndsAt == "" {
				versions[index].CoverageStatus = "historical_provider_required"
			} else {
				versions[index].CoverageStatus = "unknown"
			}
		}
	}
	return versions
}

func applyHistoricalObservations(versions []Version) {
	var observations []historicalObservation
	if err := json.Unmarshal(historicalObservationsJSON, &observations); err != nil {
		panic("invalid embedded historical observations: " + err.Error())
	}
	byID := make(map[string]*Version, len(versions))
	for index := range versions {
		byID[versions[index].ID] = &versions[index]
	}
	seen := make(map[string]bool, len(observations))
	for _, observation := range observations {
		if observation.ID == "" || seen[observation.ID] {
			panic("duplicate or empty historical observation id: " + observation.ID)
		}
		seen[observation.ID] = true
		target := byID[observation.ID]
		if target == nil {
			panic("historical observation references unknown catalog id: " + observation.ID)
		}
		if target.Ranks == nil {
			target.Ranks = make(map[string][2]*int)
		}
		if len(observation.Ranks) > 0 && observation.RankEvidence == nil {
			panic("historical rank observation requires evidence: " + observation.ID)
		}
		if observation.RankEvidence != nil {
			validateHistoricalEvidence(observation.ID, observation.RankEvidence)
		}
		for market, ranks := range observation.Ranks {
			if market != "CN" && market != "JP" && market != "US" && market != "KR" {
				panic("historical observation contains unsupported market: " + market)
			}
			for _, rank := range ranks {
				if rank != nil && (*rank < 1 || *rank > 200) {
					panic(fmt.Sprintf("historical observation rank outside 1-200 for %s", observation.ID))
				}
			}
			target.Ranks[market] = ranks
		}
		if observation.RankEvidence != nil {
			target.RankEvidence = observation.RankEvidence
		}
		if len(observation.AppHours) > 0 {
			for _, appObservation := range observation.AppHours {
				if target.WindowHours > 0 && appObservation.Hours != nil && *appObservation.Hours > float64(target.WindowHours) {
					panic(fmt.Sprintf("historical app-line hours exceed phase window for %s", observation.ID))
				}
			}
			target.AppHours = mergeAppLineObservations(observation.ID, target.AppHours, observation.AppHours)
		}
	}
}

func mergeAppLineObservations(observationID string, base, updates []AppLineObservation) []AppLineObservation {
	result := append([]AppLineObservation(nil), base...)
	byID := make(map[string]int, len(result))
	allowedAppIDs := make(map[string]bool, len(defaultAppLines))
	for _, appLine := range defaultAppLines {
		allowedAppIDs[appLine.AppID] = true
	}
	for index, observation := range result {
		byID[observation.AppID] = index
	}
	for _, update := range updates {
		if update.AppID == "" || update.Hours == nil || *update.Hours < 0 || update.Evidence == nil {
			panic("historical app-line observation requires an app id, non-negative hours, and evidence")
		}
		if !allowedAppIDs[update.AppID] {
			panic("historical app-line observation uses an unsupported app id: " + update.AppID)
		}
		if update.DataStatus != "public_video_summary" && update.DataStatus != "verified_manual" {
			panic("historical app-line observation requires a historical data status: " + observationID)
		}
		if update.UpdatedAt == nil {
			panic("historical app-line observation requires an evidence date: " + observationID)
		}
		if _, err := time.Parse("2006-01-02", *update.UpdatedAt); err != nil {
			panic("historical app-line observation has an invalid evidence date: " + observationID)
		}
		validateHistoricalEvidence(observationID, update.Evidence)
		if index, ok := byID[update.AppID]; ok {
			result[index] = update
			continue
		}
		byID[update.AppID] = len(result)
		result = append(result, update)
	}
	return result
}

func validateHistoricalEvidence(observationID string, evidence *MetricEvidence) {
	if evidence == nil || !isHTTPSURL(evidence.PrimaryURL) {
		panic("historical observation requires an HTTPS primary evidence URL: " + observationID)
	}
	if evidence.CrossCheckURL != "" && !isHTTPSURL(evidence.CrossCheckURL) {
		panic("historical observation has an invalid cross-check URL: " + observationID)
	}
	if strings.TrimSpace(evidence.NoteZh) == "" || strings.TrimSpace(evidence.NoteEn) == "" {
		panic("historical observation requires bilingual evidence notes: " + observationID)
	}
}

func isHTTPSURL(raw string) bool {
	parsed, err := url.Parse(raw)
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}

func normalizeLocalizedNames(version *Version) {
	version.CharactersZh = chineseNameCorrections.Replace(version.CharactersZh)
	version.CharactersEn = englishNameCorrections.Replace(version.CharactersEn)
}

func clone(version Version) Version {
	version.Estimate = cloneFloatPointer(version.Estimate)
	version.P25 = cloneFloatPointer(version.P25)
	version.P75 = cloneFloatPointer(version.P75)
	version.CollectionStartedAt = cloneStringPointer(version.CollectionStartedAt)
	version.Ranks = cloneRanks(version.Ranks)
	version.RankEvidence = cloneEvidence(version.RankEvidence)
	appHours := version.AppHours
	version.AppHours = make([]AppLineObservation, len(appHours))
	for index, observation := range appHours {
		observation.Hours = cloneFloatPointer(observation.Hours)
		observation.UpdatedAt = cloneStringPointer(observation.UpdatedAt)
		observation.Evidence = cloneEvidence(observation.Evidence)
		version.AppHours[index] = observation
	}
	return version
}

func cloneRanks(source map[string][2]*int) map[string][2]*int {
	result := make(map[string][2]*int, len(source))
	for market, ranks := range source {
		result[market] = [2]*int{cloneIntPointer(ranks[0]), cloneIntPointer(ranks[1])}
	}
	return result
}

func cloneEvidence(source *MetricEvidence) *MetricEvidence {
	if source == nil {
		return nil
	}
	result := *source
	return &result
}

func cloneIntPointer(source *int) *int {
	if source == nil {
		return nil
	}
	result := *source
	return &result
}

func cloneFloatPointer(source *float64) *float64 {
	if source == nil {
		return nil
	}
	result := *source
	return &result
}

func cloneStringPointer(source *string) *string {
	if source == nil {
		return nil
	}
	result := *source
	return &result
}
