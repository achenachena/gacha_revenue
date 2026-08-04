package revenuesource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"gacha-revenue/backend/internal/revenue"
)

const maxResponseBytes = 8 << 20

type httpClient interface {
	Do(*http.Request) (*http.Response, error)
}

type Client struct {
	http httpClient
}

type Result struct {
	History revenue.GameHistory
	Err     error
}

func New(client httpClient) *Client {
	return &Client{http: client}
}

func (c *Client) FetchAll(ctx context.Context) []Result {
	results := make([]Result, len(revenue.Definitions))
	fetchedAt := time.Now().UTC()
	var group sync.WaitGroup
	for index, definition := range revenue.Definitions {
		group.Add(1)
		go func(index int, definition revenue.GameDefinition) {
			defer group.Done()
			history, sourceURL, err := c.Fetch(ctx, definition.Slug)
			results[index] = Result{History: revenue.GameHistory{
				GameID: definition.ID, History: history, SourceURL: sourceURL,
				SourceFetchedAt: fetchedAt, SourceStatus: "live_public_source",
			}, Err: err}
		}(index, definition)
	}
	group.Wait()
	return results
}

func (c *Client) Fetch(ctx context.Context, slug string) ([]revenue.Month, string, error) {
	if slug == "" || strings.ContainsAny(slug, "/?#") {
		return nil, "", fmt.Errorf("invalid source slug")
	}
	sourceURL := "https://www.gachadash.com/game/" + slug
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, sourceURL, err
	}
	request.Header.Set("User-Agent", "gacha-revenue-observatory/1.0")
	response, err := c.http.Do(request)
	if err != nil {
		return nil, sourceURL, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, sourceURL, fmt.Errorf("source returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, sourceURL, err
	}
	if len(body) > maxResponseBytes {
		return nil, sourceURL, fmt.Errorf("source response exceeded 8 MiB")
	}
	history, err := Parse(string(body))
	for index := range history {
		history[index].SourceURL = sourceURL
	}
	return history, sourceURL, err
}

func Parse(text string) ([]revenue.Month, error) {
	marker := `\"revenueHistory\":`
	start := strings.Index(text, marker)
	if start < 0 {
		marker = `"revenueHistory":`
		start = strings.Index(text, marker)
	}
	if start < 0 {
		return nil, fmt.Errorf("revenue history not found")
	}
	start += len(marker)
	arrayStart := strings.Index(text[start:], "[")
	if arrayStart < 0 {
		return nil, fmt.Errorf("revenue history array not found")
	}
	start += arrayStart
	finish := strings.Index(text[start:], "]")
	if finish < 0 {
		return nil, fmt.Errorf("revenue history was truncated")
	}
	encoded := strings.ReplaceAll(text[start:start+finish+1], `\"`, `"`)
	var source []struct {
		Year         int   `json:"year"`
		Month        int   `json:"month"`
		RevenueTotal int64 `json:"revenue_total"`
	}
	if err := json.Unmarshal([]byte(encoded), &source); err != nil {
		return nil, fmt.Errorf("decode revenue history: %w", err)
	}
	if len(source) == 0 {
		return nil, fmt.Errorf("revenue history was empty")
	}
	history := make([]revenue.Month, 0, len(source))
	seen := make(map[int]bool, len(source))
	for _, item := range source {
		key := item.Year*100 + item.Month
		value := float64(item.RevenueTotal) / 100_000_000
		if item.Year < 2010 || item.Year > 2200 || item.Month < 1 || item.Month > 12 || item.RevenueTotal <= 0 || value > revenue.MaxMonthlyUSDMillions {
			return nil, fmt.Errorf("invalid revenue point: year=%d month=%d total=%d", item.Year, item.Month, item.RevenueTotal)
		}
		if seen[key] {
			return nil, fmt.Errorf("duplicate revenue point: %04d-%02d", item.Year, item.Month)
		}
		seen[key] = true
		history = append(history, revenue.Month{
			Year: item.Year, Month: item.Month, Value: value,
			MarketCoverage: revenue.MarketCoverageComplete, Scope: revenue.ScopeCombinedMobile,
			SourceID: "gacha_dash",
		})
	}
	sort.Slice(history, func(i, j int) bool {
		return history[i].Year < history[j].Year || history[i].Year == history[j].Year && history[i].Month < history[j].Month
	})
	return history, nil
}
