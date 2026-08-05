package rankfeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"gacha-revenue/backend/internal/rankstore"
)

const maxResponseBytes = 2 << 20

var (
	knownMarkets = map[string]bool{"CN": true, "JP": true, "US": true, "KR": true}
	knownGames   = map[string]bool{"genshin": true, "hsr": true, "zzz": true, "wuwa": true, "endfield": true, "nte": true}
	knownLines   = map[string]bool{"douyin": true, "tencent_video": true, "qq_music": true, "capcut_cn": true, "netease_music": true, "baidu_netdisk": true, "quark": true}
)

type httpClient interface {
	Do(*http.Request) (*http.Response, error)
}

type Client struct {
	client httpClient
	url    string
	token  string
}

type payload struct {
	Data []rankstore.Snapshot `json:"data"`
}

func New(client httpClient, feedURL, token string) (*Client, error) {
	if strings.TrimSpace(feedURL) == "" {
		return nil, nil
	}
	parsed, err := url.Parse(feedURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return nil, fmt.Errorf("rank history feed URL must be an HTTPS URL without credentials or fragments")
	}
	if client == nil {
		return nil, fmt.Errorf("rank history HTTP client is required")
	}
	return &Client{client: client, url: parsed.String(), token: token}, nil
}

func (c *Client) QueryRange(ctx context.Context, gameID string, start, end time.Time) ([]rankstore.Snapshot, error) {
	if !knownGames[gameID] || !end.After(start) || end.Sub(start) > 62*24*time.Hour {
		return nil, fmt.Errorf("invalid rank history query")
	}
	endpoint, _ := url.Parse(c.url)
	query := endpoint.Query()
	query.Set("game_id", gameID)
	query.Set("start", start.UTC().Format(time.RFC3339))
	query.Set("end", end.UTC().Format(time.RFC3339))
	endpoint.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "gacha-revenue-observatory/3.0")
	if c.token != "" {
		request.Header.Set("Authorization", "Bearer "+c.token)
	}
	response, err := c.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch rank history: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("rank history feed returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read rank history feed: %w", err)
	}
	if len(body) > maxResponseBytes {
		return nil, fmt.Errorf("rank history feed response is too large")
	}
	var decoded payload
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, fmt.Errorf("decode rank history feed: %w", err)
	}
	if err := validate(decoded.Data, gameID, start, end); err != nil {
		return nil, err
	}
	sort.Slice(decoded.Data, func(i, j int) bool { return decoded.Data[i].ObservedHour.Before(decoded.Data[j].ObservedHour) })
	return decoded.Data, nil
}

func validate(items []rankstore.Snapshot, gameID string, start, end time.Time) error {
	if len(items) > 1500 {
		return fmt.Errorf("rank history feed contains too many snapshots")
	}
	seen := make(map[int64]bool, len(items))
	for index, snapshot := range items {
		hour := snapshot.ObservedHour.UTC()
		if !hour.Equal(hour.Truncate(time.Hour)) || hour.Before(start.UTC()) || !hour.Before(end.UTC()) || seen[hour.Unix()] {
			return fmt.Errorf("rank history snapshot %d has invalid observed_hour", index)
		}
		seen[hour.Unix()] = true
		for market, values := range snapshot.Markets {
			if !knownMarkets[market] {
				return fmt.Errorf("rank history snapshot %d has invalid market", index)
			}
			visibleLimit := rankstore.VisibleLimit(values)
			if visibleLimit < 1 || visibleLimit > 5000 {
				return fmt.Errorf("rank history snapshot %d has invalid feed limit", index)
			}
			for subject, rank := range values.Games {
				if subject != gameID || rank < 1 || rank > visibleLimit {
					return fmt.Errorf("rank history snapshot %d has invalid game rank", index)
				}
			}
			for subject, rank := range values.AppLines {
				if market != "CN" || !knownLines[subject] || rank < 1 || rank > visibleLimit {
					return fmt.Errorf("rank history snapshot %d has invalid app-line rank", index)
				}
			}
		}
	}
	return nil
}
