package bannercalendar

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	maxResponseBytes = 1 << 20
	cacheTTL         = time.Minute
)

var (
	allowedGames = map[string]bool{"genshin": true, "hsr": true, "zzz": true, "wuwa": true, "endfield": true, "nte": true}
	idPattern    = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,79}$`)
)

// Banner is the normalized contract accepted from a licensed or maintained
// calendar provider. Provider-specific adapters stay outside the public API.
type Banner struct {
	ID              string `json:"id"`
	GameID          string `json:"game_id"`
	Version         string `json:"version"`
	PhaseIndex      int    `json:"phase_index"`
	PhaseZh         string `json:"phase_zh"`
	PhaseEn         string `json:"phase_en"`
	CharactersZh    string `json:"characters_zh"`
	CharactersEn    string `json:"characters_en"`
	StartsAt        string `json:"starts_at"`
	EndsAt          string `json:"ends_at"`
	SourceURL       string `json:"source_url"`
	SourceUpdatedAt string `json:"source_updated_at"`
}

type feedPayload struct {
	Data []Banner `json:"data"`
}

type httpClient interface {
	Do(*http.Request) (*http.Response, error)
}

type Client struct {
	client httpClient
	url    string
	token  string

	mu        sync.RWMutex
	cached    []Banner
	fetchedAt time.Time
}

func New(client httpClient, feedURL, token string) (*Client, error) {
	if strings.TrimSpace(feedURL) == "" {
		return nil, nil
	}
	parsed, err := url.Parse(feedURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return nil, fmt.Errorf("calendar feed URL must be an HTTPS URL without credentials or fragments")
	}
	if client == nil {
		return nil, fmt.Errorf("calendar feed HTTP client is required")
	}
	return &Client{client: client, url: parsed.String(), token: token}, nil
}

func (c *Client) List(ctx context.Context, gameID string) ([]Banner, error) {
	if gameID != "" && !allowedGames[gameID] {
		return nil, fmt.Errorf("unsupported game_id")
	}
	c.mu.RLock()
	cached := append([]Banner(nil), c.cached...)
	fetchedAt := c.fetchedAt
	c.mu.RUnlock()
	if !fetchedAt.IsZero() && time.Since(fetchedAt) < cacheTTL {
		return filter(cached, gameID), nil
	}

	validated, err := c.fetch(ctx)
	if err != nil {
		// Calendar availability must not make previously known banners disappear.
		// The next request retries because fetchedAt is left unchanged.
		if !fetchedAt.IsZero() {
			return filter(cached, gameID), nil
		}
		return nil, err
	}
	c.mu.Lock()
	c.cached = append([]Banner(nil), validated...)
	c.fetchedAt = time.Now()
	c.mu.Unlock()
	return filter(validated, gameID), nil
}

func (c *Client) fetch(ctx context.Context) ([]Banner, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
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
		return nil, fmt.Errorf("fetch calendar feed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("calendar feed returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read calendar feed: %w", err)
	}
	if len(body) > maxResponseBytes {
		return nil, fmt.Errorf("calendar feed exceeded %d bytes", maxResponseBytes)
	}
	var payload feedPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode calendar feed: %w", err)
	}
	return validate(payload.Data)
}

func validate(items []Banner) ([]Banner, error) {
	if len(items) > 500 {
		return nil, fmt.Errorf("calendar feed contains too many banners")
	}
	seen := make(map[string]bool, len(items))
	for index := range items {
		item := &items[index]
		if !idPattern.MatchString(item.ID) || !allowedGames[item.GameID] || item.PhaseIndex < 1 || item.PhaseIndex > 9 {
			return nil, fmt.Errorf("calendar feed item %d has invalid identity", index)
		}
		if seen[item.ID] {
			return nil, fmt.Errorf("calendar feed contains duplicate id %q", item.ID)
		}
		seen[item.ID] = true
		if len(item.Version) == 0 || len(item.Version) > 24 || len(item.CharactersZh) == 0 || len(item.CharactersZh) > 300 || len(item.CharactersEn) == 0 || len(item.CharactersEn) > 300 {
			return nil, fmt.Errorf("calendar feed item %q has invalid text fields", item.ID)
		}
		start, startErr := time.Parse("2006-01-02", item.StartsAt)
		end, endErr := time.Parse("2006-01-02", item.EndsAt)
		if startErr != nil || endErr != nil || !end.After(start) || end.Sub(start) > 62*24*time.Hour {
			return nil, fmt.Errorf("calendar feed item %q has invalid window", item.ID)
		}
		if item.SourceURL != "" {
			source, err := url.Parse(item.SourceURL)
			if err != nil || source.Scheme != "https" || source.Host == "" || source.User != nil {
				return nil, fmt.Errorf("calendar feed item %q has invalid source_url", item.ID)
			}
		}
		if _, err := time.Parse("2006-01-02", item.SourceUpdatedAt); err != nil {
			return nil, fmt.Errorf("calendar feed item %q has invalid source_updated_at", item.ID)
		}
		if item.PhaseZh == "" {
			item.PhaseZh = fmt.Sprintf("第 %d 期", item.PhaseIndex)
		}
		if item.PhaseEn == "" {
			item.PhaseEn = fmt.Sprintf("Phase %d", item.PhaseIndex)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].StartsAt == items[j].StartsAt {
			return items[i].ID < items[j].ID
		}
		return items[i].StartsAt > items[j].StartsAt
	})
	return items, nil
}

func filter(items []Banner, gameID string) []Banner {
	result := make([]Banner, 0, len(items))
	for _, item := range items {
		if gameID == "" || item.GameID == gameID {
			result = append(result, item)
		}
	}
	return result
}
