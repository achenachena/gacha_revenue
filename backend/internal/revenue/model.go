package revenue

import (
	"fmt"
	"sort"
	"time"
)

const (
	Currency                 = "USD"
	Unit                     = "million"
	Basis                    = "mobile_iap_ios_android"
	ChinaAndroidMultiplier   = 1.75
	MethodologyVersion       = "4.0.0"
	VersionAllocationFormula = "sum(month_revenue * overlap_hours / month_hours)"
	MaxMonthlyUSDMillions    = 10_000.0
)

type Month struct {
	Year  int     `json:"year"`
	Month int     `json:"month"`
	Value float64 `json:"value"`
}

type GameDefinition struct {
	ID         string   `json:"id"`
	Slug       string   `json:"source_slug"`
	LaunchDate string   `json:"launch_date"`
	NameZh     string   `json:"name_zh"`
	NameEn     string   `json:"name_en"`
	Publisher  string   `json:"publisher"`
	Platforms  []string `json:"platforms"`
}

type GameHistory struct {
	GameID          string    `json:"game_id"`
	History         []Month   `json:"history"`
	SourceURL       string    `json:"source_url"`
	SourceFetchedAt time.Time `json:"source_fetched_at"`
	SourceStatus    string    `json:"source_status"`
}

type Period struct {
	Year  int `json:"year"`
	Month int `json:"month"`
}

type AnnualSummary struct {
	Year     int     `json:"year"`
	Value    float64 `json:"value"`
	Months   int     `json:"months"`
	Complete bool    `json:"complete"`
}

type GameSummary struct {
	GameDefinition
	History         []Month         `json:"history"`
	SourceURL       string          `json:"source_url"`
	SourceFetchedAt time.Time       `json:"source_fetched_at"`
	SourceStatus    string          `json:"source_status"`
	Latest          *Month          `json:"latest"`
	YTD             *float64        `json:"ytd"`
	ChangePercent   *float64        `json:"change_percent"`
	Yearly          []AnnualSummary `json:"yearly"`
}

type PhaseEstimate struct {
	Estimate       *float64 `json:"estimate"`
	Coverage       float64  `json:"coverage"`
	CoveredHours   int      `json:"covered_hours"`
	WindowHours    int      `json:"window_hours"`
	Formula        string   `json:"formula"`
	SourceCurrency string   `json:"source_currency"`
	SourceUnit     string   `json:"source_unit"`
}

type MethodologyFormula struct {
	ID         string `json:"id"`
	TitleZh    string `json:"title_zh"`
	TitleEn    string `json:"title_en"`
	Expression string `json:"expression"`
}

type MethodologyDefinition struct {
	Symbol string `json:"symbol"`
	TextZh string `json:"text_zh"`
	TextEn string `json:"text_en"`
}

type MethodologySource struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	URL   string `json:"url"`
}

type MethodologyDocument struct {
	Version     string                  `json:"version"`
	Basis       string                  `json:"basis"`
	ExcludesZh  string                  `json:"excludes_zh"`
	ExcludesEn  string                  `json:"excludes_en"`
	Formulas    []MethodologyFormula    `json:"formulas"`
	Definitions []MethodologyDefinition `json:"definitions"`
	Sources     []MethodologySource     `json:"sources"`
}

func Methodology() MethodologyDocument {
	return MethodologyDocument{
		Version:    MethodologyVersion,
		Basis:      Basis,
		ExcludesZh: "第三方移动端 IAP 市场估算；不含 PC、主机、广告、电商周边与 IP 授权。",
		ExcludesEn: "Third-party mobile IAP estimates; excludes PC, console, ads, merchandise, and IP licensing.",
		Formulas: []MethodologyFormula{
			{ID: "published_month", TitleZh: "月流水公开口径", TitleEn: "Published monthly basis", Expression: "M[g,m] = ST(iOS ex-CN) + ST(Android ex-CN) + ST(iOS CN) x (1 + 1.75)"},
			{ID: "china_android", TitleZh: "中国安卓补全", TitleEn: "China Android completion", Expression: "CN_Android[g,m] = ST(iOS CN) x 1.75"},
			{ID: "version_allocation", TitleZh: "上下半卡池归属", TitleEn: "Phase attribution", Expression: "R[g,p] = sum_m M[g,m] x overlap_hours[p,m] / month_hours[m]"},
			{ID: "app_line_hours", TitleZh: "应用线时长", TitleEn: "App-line hours", Expression: "H[g,p,a] = sum_t 1(rank[g,t] < rank[a,t]) x delta_t"},
		},
		Definitions: []MethodologyDefinition{
			{Symbol: "M", TextZh: "直接使用公开源发布的美元移动端估算，不添加 PC、主机或官网直充。", TextEn: "Uses source-published USD mobile estimates directly, without PC, console, or direct-store uplift."},
			{Symbol: "1.75", TextZh: "公开源采用的中国 Android / 中国 iOS 倍率，是模型假设而非审计事实。", TextEn: "The public source's China Android / China iOS multiplier; a model assumption, not audited revenue."},
			{Symbol: "overlap", TextZh: "每个卡池按其与各自然月重叠的准确小时数分配月流水；跨月分别计算。", TextEn: "Allocates each monthly estimate by the banner's exact overlapping hours; cross-month windows are calculated month by month."},
			{Symbol: "H", TextZh: "仅累计双方在同一小时都有中国区 iOS 畅销总榜观测且游戏名次更高的小时。", TextEn: "Counts only hours where both China iOS grossing ranks are observed and the game ranks higher."},
			{Symbol: "FX", TextZh: "人民币只用于展示：美元估算乘以 ECB 每日 USD/CNY 参考汇率；底层值保持美元。", TextEn: "CNY is display-only: USD estimates are multiplied by the ECB daily USD/CNY reference rate; canonical values remain USD."},
		},
		Sources: []MethodologySource{
			{ID: "sensor_tower", Label: "Sensor Tower", URL: "https://sensortower.com/product/mobile-app/app-performance-insights"},
			{ID: "apple_rss", Label: "Apple Top Grossing RSS", URL: "https://itunes.apple.com/cn/rss/topgrossingapplications/limit=100/json"},
		},
	}
}

func Merge(histories ...[]Month) []Month {
	byMonth := make(map[int]Month)
	for _, history := range histories {
		for _, item := range history {
			if item.Year < 2010 || item.Month < 1 || item.Month > 12 || item.Value <= 0 || item.Value > MaxMonthlyUSDMillions {
				continue
			}
			byMonth[item.Year*100+item.Month] = item
		}
	}
	merged := make([]Month, 0, len(byMonth))
	for _, item := range byMonth {
		merged = append(merged, item)
	}
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].Year < merged[j].Year || merged[i].Year == merged[j].Year && merged[i].Month < merged[j].Month
	})
	return merged
}

func LatestPeriod(histories []GameHistory) *Period {
	var latest *Period
	for _, game := range histories {
		for _, item := range game.History {
			if latest == nil || item.Year*12+item.Month > latest.Year*12+latest.Month {
				value := Period{Year: item.Year, Month: item.Month}
				latest = &value
			}
		}
	}
	return latest
}

func Summarize(definition GameDefinition, source GameHistory, period *Period) GameSummary {
	history := Merge(source.History)
	result := GameSummary{
		GameDefinition:  definition,
		History:         history,
		SourceURL:       source.SourceURL,
		SourceFetchedAt: source.SourceFetchedAt,
		SourceStatus:    source.SourceStatus,
		Yearly:          annualSummaries(history),
	}
	if period == nil {
		return result
	}
	byPeriod := make(map[int]Month, len(history))
	for _, item := range history {
		byPeriod[item.Year*100+item.Month] = item
	}
	if latest, ok := byPeriod[period.Year*100+period.Month]; ok {
		value := latest
		result.Latest = &value
		previousDate := time.Date(period.Year, time.Month(period.Month), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -1, 0)
		if previous, exists := byPeriod[previousDate.Year()*100+int(previousDate.Month())]; exists && previous.Value > 0 {
			change := (latest.Value - previous.Value) / previous.Value * 100
			result.ChangePercent = &change
		}
	}
	ytd, months := 0.0, 0
	for _, item := range history {
		if item.Year == period.Year && item.Month <= period.Month {
			ytd += item.Value
			months++
		}
	}
	if months > 0 {
		result.YTD = &ytd
	}
	return result
}

func EstimateWindow(history []Month, startsAt, endsAt string) PhaseEstimate {
	result := PhaseEstimate{Formula: VersionAllocationFormula, SourceCurrency: Currency, SourceUnit: Unit}
	start, startErr := time.Parse("2006-01-02", startsAt)
	end, endErr := time.Parse("2006-01-02", endsAt)
	if startErr != nil || endErr != nil || !end.After(start) {
		return result
	}
	windowHours := int(end.Sub(start).Hours())
	result.WindowHours = windowHours
	if windowHours <= 0 {
		return result
	}
	byMonth := make(map[int]Month, len(history))
	for _, item := range history {
		byMonth[item.Year*100+item.Month] = item
	}
	estimate, coveredHours := 0.0, 0
	monthStart := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
	for monthStart.Before(end) {
		monthEnd := monthStart.AddDate(0, 1, 0)
		overlapStart := maxTime(start, monthStart)
		overlapEnd := minTime(end, monthEnd)
		if overlapEnd.After(overlapStart) {
			if item, ok := byMonth[monthStart.Year()*100+int(monthStart.Month())]; ok {
				hours := int(overlapEnd.Sub(overlapStart).Hours())
				coveredHours += hours
				estimate += item.Value * overlapEnd.Sub(overlapStart).Hours() / monthEnd.Sub(monthStart).Hours()
			}
		}
		monthStart = monthEnd
	}
	result.CoveredHours = coveredHours
	result.Coverage = float64(coveredHours) / float64(windowHours)
	if coveredHours > 0 {
		result.Estimate = &estimate
	}
	return result
}

func annualSummaries(history []Month) []AnnualSummary {
	byYear := make(map[int][]Month)
	for _, item := range history {
		byYear[item.Year] = append(byYear[item.Year], item)
	}
	years := make([]int, 0, len(byYear))
	for year := range byYear {
		years = append(years, year)
	}
	sort.Ints(years)
	result := make([]AnnualSummary, 0, len(years))
	for _, year := range years {
		value := 0.0
		months := make(map[int]bool, len(byYear[year]))
		for _, item := range byYear[year] {
			value += item.Value
			months[item.Month] = true
		}
		result = append(result, AnnualSummary{Year: year, Value: value, Months: len(months), Complete: len(months) == 12})
	}
	return result
}

func Validate(history GameHistory) error {
	if history.GameID == "" {
		return fmt.Errorf("game id is required")
	}
	if _, ok := Definition(history.GameID); !ok {
		return fmt.Errorf("unknown game id %q", history.GameID)
	}
	seen := make(map[int]bool, len(history.History))
	for _, item := range history.History {
		key := item.Year*100 + item.Month
		if item.Year < 2010 || item.Year > 2200 || item.Month < 1 || item.Month > 12 || item.Value <= 0 || item.Value > MaxMonthlyUSDMillions {
			return fmt.Errorf("invalid revenue month %d-%02d", item.Year, item.Month)
		}
		if seen[key] {
			return fmt.Errorf("duplicate revenue month %d-%02d", item.Year, item.Month)
		}
		seen[key] = true
	}
	return nil
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
