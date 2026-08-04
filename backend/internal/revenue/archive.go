package revenue

import "time"

var Definitions = []GameDefinition{
	{ID: "genshin", Slug: "genshin-impact", LaunchDate: "2020-09-28", NameZh: "原神", NameEn: "Genshin Impact", Publisher: "HoYoverse", Platforms: []string{"ios", "android", "pc", "playstation"}},
	{ID: "hsr", Slug: "honkai-star-rail", LaunchDate: "2023-04-26", NameZh: "崩坏：星穹铁道", NameEn: "Honkai: Star Rail", Publisher: "HoYoverse", Platforms: []string{"ios", "android", "pc", "playstation"}},
	{ID: "zzz", Slug: "zenless-zone-zero", LaunchDate: "2024-07-04", NameZh: "绝区零", NameEn: "Zenless Zone Zero", Publisher: "HoYoverse", Platforms: []string{"ios", "android", "pc", "playstation", "xbox"}},
	{ID: "wuwa", Slug: "wuthering-waves", LaunchDate: "2024-05-23", NameZh: "鸣潮", NameEn: "Wuthering Waves", Publisher: "Kuro Games", Platforms: []string{"ios", "android", "pc", "playstation"}},
	{ID: "endfield", Slug: "arknights-endfield", LaunchDate: "2026-01-22", NameZh: "明日方舟：终末地", NameEn: "Arknights: Endfield", Publisher: "GRYPHLINE", Platforms: []string{"ios", "android", "pc", "playstation"}},
	{ID: "nte", Slug: "neverness-to-everness", LaunchDate: "2026-04-29", NameZh: "异环", NameEn: "Neverness to Everness", Publisher: "Hotta Studio / Perfect World", Platforms: []string{"ios", "android", "pc", "playstation"}},
}

var archiveSeries = []struct {
	GameID string
	Start  string
	Values []float64
}{
	{"genshin", "2024-01-01", []float64{99.25, 92.75, 68, 119.5, 53.25, 67.5, 37.25, 42.25, 46.25, 52.75, 37.795, 45.585, 99.44, 27.28, 39.845, 22.69, 36.085, 65.505, 42.335, 27.765, 43.875, 56.725, 20.97, 40.825, 66.04, 55.245, 40.11, 40.105, 41.655, 33.34}},
	{"hsr", "2024-01-01", []float64{47.5, 92.5, 144.25, 109, 91, 95.5, 41.25, 40.25, 69, 43.25, 23.595, 55.52, 50.775, 45.785, 29.935, 103.45, 44.575, 19.12, 92.45, 29.925, 39.535, 23.45, 81.38, 27.895, 8.0375, 21.135, 31.73, 58.1, 38.765, 28.455}},
	{"zzz", "2024-07-01", []float64{99.75, 32.5, 35.5, 15.5, 20.29, 57.93, 26.255, 17.935, 15.915, 21.94, 10.615, 38.34, 22.96, 15.925, 10.89, 12.915, 10.89, 27.55, 23.245, 13.35, 16.44, 7.167, 9.37, 9.655}},
	{"wuwa", "2024-05-01", []float64{25.75, 46.25, 29.5, 13.5, 11.5, 9.75, 18.25, 7.75, 28, 13.775, 21.625, 21.625, 25.35, 39.975, 16.875, 14.875, 21.9, 16.6, 18.875, 23.175, 19.15, 46, 11.4, 14.7, 31.75, 34}},
	{"endfield", "2026-01-01", []float64{28.55, 26.08, 22.05, 17.28, 4.766, 9.52}},
	{"nte", "2026-04-01", []float64{6.74, 23.575, 13.95}},
}

func Archive() []GameHistory {
	fetchedAt := time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)
	result := make([]GameHistory, 0, len(archiveSeries))
	for _, series := range archiveSeries {
		start, err := time.Parse("2006-01-02", series.Start)
		if err != nil {
			panic("invalid bundled revenue start date: " + series.Start)
		}
		history := make([]Month, 0, len(series.Values))
		for index, value := range series.Values {
			month := start.AddDate(0, index, 0)
			history = append(history, Month{Year: month.Year(), Month: int(month.Month()), Value: value})
		}
		result = append(result, GameHistory{
			GameID: series.GameID, History: history, SourceURL: "https://revenue.ennead.cc/revenue",
			SourceFetchedAt: fetchedAt, SourceStatus: "bundled_verified_snapshot",
		})
	}
	return result
}

func Definition(gameID string) (GameDefinition, bool) {
	for _, definition := range Definitions {
		if definition.ID == gameID {
			return definition, true
		}
	}
	return GameDefinition{}, false
}
