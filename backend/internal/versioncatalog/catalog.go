package versioncatalog

import (
	_ "embed"
	"encoding/json"
)

type Version struct {
	ID                  string               `json:"id"`
	GameID              string               `json:"game_id"`
	Version             string               `json:"version"`
	PhaseIndex          int                  `json:"phase_index"`
	PhaseZh             string               `json:"phase_zh"`
	PhaseEn             string               `json:"phase_en"`
	CharactersZh        string               `json:"characters_zh"`
	CharactersEn        string               `json:"characters_en"`
	StartsAt            string               `json:"starts_at"`
	EndsAt              string               `json:"ends_at"`
	Estimate            *float64             `json:"estimate"`
	P25                 *float64             `json:"p25"`
	P75                 *float64             `json:"p75"`
	Confidence          string               `json:"confidence"`
	RevenueCoverage     float64              `json:"revenue_coverage"`
	RevenueCoveredHours int                  `json:"revenue_covered_hours"`
	WindowHours         int                  `json:"window_hours"`
	RevenueFormula      string               `json:"revenue_formula"`
	CoverageStatus      string               `json:"coverage_status"`
	ObservedHours       int                  `json:"observed_hours"`
	CollectionStartedAt *string              `json:"collection_started_at"`
	Ranks               map[string][2]*int   `json:"ios_grossing_rank_range"`
	RankEvidence        *MetricEvidence      `json:"rank_evidence"`
	AppHours            []AppLineObservation `json:"app_line_observations"`
	DataStatus          string               `json:"data_status"`
	Source              string               `json:"source"`
	SourceURL           string               `json:"source_url"`
	SourceDate          string               `json:"source_updated_at"`
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

func load() []Version {
	var versions []Version
	if err := json.Unmarshal(catalogJSON, &versions); err != nil {
		panic("invalid embedded version catalog: " + err.Error())
	}
	for index := range versions {
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

func clone(version Version) Version {
	version.Ranks = cloneRanks(version.Ranks)
	version.AppHours = append([]AppLineObservation(nil), version.AppHours...)
	return version
}

func cloneRanks(source map[string][2]*int) map[string][2]*int {
	result := make(map[string][2]*int, len(source))
	for market, ranks := range source {
		result[market] = ranks
	}
	return result
}
