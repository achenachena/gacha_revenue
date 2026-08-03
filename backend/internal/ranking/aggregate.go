package ranking

import (
	"sort"
	"time"
)

type Snapshot struct {
	Hour time.Time
	Rank int
}

type Result struct {
	BannerID      string
	HoursAbove    int
	ObservedHours int
	ExpectedHours int
	Coverage      float64
}

// Aggregate compares only paired hourly observations. Missing game or app
// ranks are unknown and are never interpreted as zero hours above.
func Aggregate(bannerID string, startsAt, endsAt time.Time, game, app []Snapshot) Result {
	gameByHour := normalize(game, startsAt, endsAt)
	appByHour := normalize(app, startsAt, endsAt)
	result := Result{BannerID: bannerID, ExpectedHours: int(endsAt.Sub(startsAt).Hours())}
	for hour, gameRank := range gameByHour {
		appRank, ok := appByHour[hour]
		if !ok {
			continue
		}
		result.ObservedHours++
		if gameRank < appRank {
			result.HoursAbove++
		}
	}
	if result.ExpectedHours > 0 {
		result.Coverage = float64(result.ObservedHours) / float64(result.ExpectedHours)
	}
	return result
}

func Sort(results []Result) {
	sort.SliceStable(results, func(i, j int) bool {
		if results[i].HoursAbove == results[j].HoursAbove {
			return results[i].BannerID < results[j].BannerID
		}
		return results[i].HoursAbove > results[j].HoursAbove
	})
}

func normalize(snapshots []Snapshot, startsAt, endsAt time.Time) map[time.Time]int {
	byHour := make(map[time.Time]int, len(snapshots))
	for _, snapshot := range snapshots {
		hour := snapshot.Hour.UTC().Truncate(time.Hour)
		if hour.Before(startsAt.UTC()) || !hour.Before(endsAt.UTC()) || snapshot.Rank < 1 {
			continue
		}
		byHour[hour] = snapshot.Rank
	}
	return byHour
}
