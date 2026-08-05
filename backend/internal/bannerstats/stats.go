package bannerstats

import (
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

var Markets = []string{"CN", "JP", "US", "KR"}

var AppLineOrder = []string{
	"douyin",
	"tencent_video",
	"qq_music",
	"capcut_cn",
	"netease_music",
	"baidu_netdisk",
	"quark",
}

type RankMetric struct {
	PeakRank         *int `json:"peak_rank"`
	LowestRank       *int `json:"lowest_rank"`
	ObservedHours    int  `json:"observed_hours"`
	RankedHours      int  `json:"ranked_hours"`
	LowestBeyondFeed bool `json:"lowest_is_beyond_feed"`
	FeedLimit        int  `json:"feed_limit"`
}

type AppLineMetric struct {
	AppID         string     `json:"app_id"`
	HoursAbove    int        `json:"hours_above"`
	ObservedHours int        `json:"observed_hours"`
	UpdatedAt     *time.Time `json:"updated_at"`
}

type Metrics struct {
	Ranks               map[string]RankMetric `json:"ranks"`
	AppLineObservations []AppLineMetric       `json:"app_line_observations"`
}

// Aggregate converts hourly source facts into one banner-window result. It is
// deliberately independent from HTTP and storage so both single-window and
// batch endpoints use exactly the same business rules.
func Aggregate(gameID string, start, end time.Time, snapshots []rankstore.Snapshot) Metrics {
	window := make([]rankstore.Snapshot, 0, len(snapshots))
	for _, snapshot := range snapshots {
		if !snapshot.ObservedHour.Before(start) && snapshot.ObservedHour.Before(end) {
			window = append(window, snapshot)
		}
	}

	ranks := make(map[string]RankMetric, len(Markets))
	for _, market := range Markets {
		metric := aggregateRank(gameID, market, window)
		if metric.ObservedHours > 0 {
			ranks[market] = metric
		}
	}

	lines := make([]AppLineMetric, 0, len(AppLineOrder))
	for _, appID := range AppLineOrder {
		lines = append(lines, aggregateAppLine(gameID, appID, window))
	}
	return Metrics{Ranks: ranks, AppLineObservations: lines}
}

func aggregateRank(gameID, market string, snapshots []rankstore.Snapshot) RankMetric {
	metric := RankMetric{}
	peak, lowest, beyondLimit, widestFeed := 0, 0, 0, 0
	for _, snapshot := range snapshots {
		marketSnapshot, ok := snapshot.Markets[market]
		if !ok {
			continue
		}
		metric.ObservedHours++
		feedLimit := rankstore.VisibleLimit(marketSnapshot)
		if feedLimit > widestFeed {
			widestFeed = feedLimit
		}
		rank, ranked := marketSnapshot.Games[gameID]
		if !ranked {
			if feedLimit > beyondLimit {
				beyondLimit = feedLimit
			}
			continue
		}
		metric.RankedHours++
		if peak == 0 || rank < peak {
			peak = rank
		}
		if rank > lowest {
			lowest = rank
		}
	}
	metric.PeakRank = rankPointer(peak)
	metric.LowestRank = rankPointer(lowest)
	metric.FeedLimit = widestFeed
	// A visible rank can be a stronger lower-bound than an older, shallower
	// feed. Only label the result as outside the feed when the missing
	// observation proves a worse rank than every visible value.
	if beyondLimit >= lowest && beyondLimit > 0 {
		metric.LowestBeyondFeed = true
		metric.FeedLimit = beyondLimit
	}
	return metric
}

func aggregateAppLine(gameID, appID string, snapshots []rankstore.Snapshot) AppLineMetric {
	metric := AppLineMetric{AppID: appID}
	for _, snapshot := range snapshots {
		cn, ok := snapshot.Markets["CN"]
		if !ok {
			continue
		}
		gameRank, gameVisible := cn.Games[gameID]
		appRank, appVisible := cn.AppLines[appID]
		// If exactly one side is visible, the ordering is still conclusive.
		// Two missing sides are indeterminate and are not counted as observed.
		if !gameVisible && !appVisible {
			continue
		}
		metric.ObservedHours++
		if gameVisible && (!appVisible || gameRank < appRank) {
			metric.HoursAbove++
		}
		observed := snapshot.ObservedHour
		metric.UpdatedAt = &observed
	}
	return metric
}

func rankPointer(value int) *int {
	if value == 0 {
		return nil
	}
	return &value
}
