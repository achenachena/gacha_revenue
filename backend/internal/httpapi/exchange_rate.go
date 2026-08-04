package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const exchangeRateSourceURL = "https://api.frankfurter.dev/v2/rate/USD/CNY?providers=ECB"

type exchangeRateData struct {
	Date     string  `json:"date"`
	Base     string  `json:"base"`
	Quote    string  `json:"quote"`
	Rate     float64 `json:"rate"`
	Provider string  `json:"provider"`
	Source   string  `json:"source_url"`
}

var exchangeRateFallback = exchangeRateData{
	Date: "2026-08-03", Base: "USD", Quote: "CNY", Rate: 6.7526,
	Provider: "European Central Bank via Frankfurter", Source: exchangeRateSourceURL,
}

var exchangeRateCache struct {
	sync.RWMutex
	data      exchangeRateData
	fetchedAt time.Time
	fallback  bool
}

type exchangeRateHTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

func (s *Server) exchangeRate(w http.ResponseWriter, r *http.Request) {
	exchangeRateCache.RLock()
	data, fetchedAt, fallback := exchangeRateCache.data, exchangeRateCache.fetchedAt, exchangeRateCache.fallback
	ttl := 12 * time.Hour
	if fallback {
		ttl = 30 * time.Minute
	}
	if data.Rate > 0 && time.Since(fetchedAt) < ttl {
		exchangeRateCache.RUnlock()
		writeExchangeRate(w, data, fetchedAt, fallback)
		return
	}
	exchangeRateCache.RUnlock()

	client := &http.Client{
		Timeout:       10 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	fresh, err := fetchExchangeRate(r.Context(), client)
	if err != nil {
		s.logger.Warn("exchange rate refresh failed", "error", err)
		if data.Rate <= 0 {
			data = exchangeRateFallback
		}
		fallback = true
	} else {
		data, fallback = fresh, false
	}
	fetchedAt = time.Now().UTC()
	exchangeRateCache.Lock()
	exchangeRateCache.data, exchangeRateCache.fetchedAt, exchangeRateCache.fallback = data, fetchedAt, fallback
	exchangeRateCache.Unlock()
	writeExchangeRate(w, data, fetchedAt, fallback)
}

func fetchExchangeRate(ctx context.Context, client exchangeRateHTTPClient) (exchangeRateData, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, exchangeRateSourceURL, nil)
	if err != nil {
		return exchangeRateData{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "gacha-revenue-observatory/1.0")
	response, err := client.Do(request)
	if err != nil {
		return exchangeRateData{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return exchangeRateData{}, fmt.Errorf("exchange-rate source returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 32<<10))
	if err != nil {
		return exchangeRateData{}, err
	}
	var source struct {
		Date  string  `json:"date"`
		Base  string  `json:"base"`
		Quote string  `json:"quote"`
		Rate  float64 `json:"rate"`
	}
	if err := json.Unmarshal(body, &source); err != nil {
		return exchangeRateData{}, fmt.Errorf("decode exchange rate: %w", err)
	}
	if source.Base != "USD" || source.Quote != "CNY" || source.Rate < 4 || source.Rate > 12 {
		return exchangeRateData{}, fmt.Errorf("invalid USD/CNY exchange rate")
	}
	if _, err := time.Parse("2006-01-02", source.Date); err != nil {
		return exchangeRateData{}, fmt.Errorf("invalid exchange-rate date")
	}
	return exchangeRateData{
		Date: source.Date, Base: source.Base, Quote: source.Quote, Rate: source.Rate,
		Provider: "European Central Bank via Frankfurter", Source: exchangeRateSourceURL,
	}, nil
}

func writeExchangeRate(w http.ResponseWriter, data exchangeRateData, fetchedAt time.Time, fallback bool) {
	w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=43200, stale-if-error=86400")
	writeJSON(w, http.StatusOK, map[string]any{
		"data": data,
		"meta": map[string]any{"fetched_at": fetchedAt, "fallback_snapshot": fallback},
	})
}
