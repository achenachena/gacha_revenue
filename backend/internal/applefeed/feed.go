package applefeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

const maxResponseBytes = 2 << 20

var GameStoreIDs = map[string]map[string]string{
	"genshin":  {"CN": "1467190251", "JP": "1517783697", "US": "1517783697", "KR": "1517783697"},
	"hsr":      {"CN": "1523037824", "JP": "1599719154", "US": "1599719154", "KR": "1599719154"},
	"zzz":      {"CN": "1606359076", "JP": "1606356401", "US": "1606356401", "KR": "1606356401"},
	"wuwa":     {"CN": "6450693428", "JP": "6475033368", "US": "6475033368", "KR": "6475033368"},
	"endfield": {"CN": "6753859465", "JP": "6752642477", "US": "6752642477", "KR": "6752642477"},
	"nte":      {"CN": "6514281568", "JP": "6754593077", "US": "6754593077", "KR": "6754593077"},
}

var AppLineStoreIDs = map[string]string{
	"douyin": "1142110895", "tencent_video": "458318329", "qq_music": "414603431",
	"capcut_cn": "1458072671", "netease_music": "590338362", "baidu_netdisk": "547166701", "quark": "1160172628",
}

var marketCountries = map[string]string{"CN": "cn", "JP": "jp", "US": "us", "KR": "kr"}

type httpClient interface {
	Do(*http.Request) (*http.Response, error)
}

type Collector struct {
	client httpClient
}

func New(client httpClient) *Collector {
	return &Collector{client: client}
}

type appleEntry struct {
	ID struct {
		Attributes struct {
			StoreID string `json:"im:id"`
		} `json:"attributes"`
	} `json:"id"`
}

type appleFeed struct {
	Feed struct {
		Entries []appleEntry `json:"entry"`
	} `json:"feed"`
}

type marketResult struct {
	market   string
	snapshot rankstore.MarketSnapshot
	err      error
}

func (c *Collector) Collect(ctx context.Context, observedHour time.Time) (rankstore.Snapshot, error) {
	if c.client == nil {
		return rankstore.Snapshot{}, fmt.Errorf("HTTP client is required")
	}
	observedHour = observedHour.UTC().Truncate(time.Hour)
	results := make(chan marketResult, len(marketCountries))
	var group sync.WaitGroup
	for market, country := range marketCountries {
		group.Add(1)
		go func(market, country string) {
			defer group.Done()
			snapshot, err := c.collectMarket(ctx, market, country)
			results <- marketResult{market: market, snapshot: snapshot, err: err}
		}(market, country)
	}
	group.Wait()
	close(results)

	snapshot := rankstore.Snapshot{ObservedHour: observedHour, Markets: make(map[string]rankstore.MarketSnapshot, len(marketCountries))}
	for result := range results {
		if result.err != nil {
			return rankstore.Snapshot{}, result.err
		}
		snapshot.Markets[result.market] = result.snapshot
	}
	return snapshot, nil
}

func (c *Collector) collectMarket(ctx context.Context, market, country string) (rankstore.MarketSnapshot, error) {
	url := fmt.Sprintf("https://itunes.apple.com/%s/rss/topgrossingapplications/limit=100/json", country)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return rankstore.MarketSnapshot{}, err
	}
	request.Header.Set("User-Agent", "gacha-revenue-observatory/2.0")
	response, err := c.client.Do(request)
	if err != nil {
		return rankstore.MarketSnapshot{}, fmt.Errorf("fetch Apple %s feed: %w", market, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return rankstore.MarketSnapshot{}, fmt.Errorf("Apple %s feed returned HTTP %d", market, response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return rankstore.MarketSnapshot{}, fmt.Errorf("read Apple %s feed: %w", market, err)
	}
	if len(body) > maxResponseBytes {
		return rankstore.MarketSnapshot{}, fmt.Errorf("Apple %s feed exceeded %d bytes", market, maxResponseBytes)
	}
	var payload appleFeed
	if err := json.Unmarshal(body, &payload); err != nil {
		return rankstore.MarketSnapshot{}, fmt.Errorf("decode Apple %s feed: %w", market, err)
	}
	if len(payload.Feed.Entries) == 0 || len(payload.Feed.Entries) > 100 {
		return rankstore.MarketSnapshot{}, fmt.Errorf("Apple %s feed returned an invalid entry count", market)
	}

	ranks := make(map[string]int, len(payload.Feed.Entries))
	for index, entry := range payload.Feed.Entries {
		if entry.ID.Attributes.StoreID != "" {
			ranks[entry.ID.Attributes.StoreID] = index + 1
		}
	}
	result := rankstore.MarketSnapshot{FeedLimit: len(payload.Feed.Entries), Games: map[string]int{}, AppLines: map[string]int{}}
	for gameID, stores := range GameStoreIDs {
		if rank, ok := ranks[stores[market]]; ok {
			result.Games[gameID] = rank
		}
	}
	if market == "CN" {
		for appID, storeID := range AppLineStoreIDs {
			if rank, ok := ranks[storeID]; ok {
				result.AppLines[appID] = rank
			}
		}
	}
	return result, nil
}
