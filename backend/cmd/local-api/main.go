package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"gacha-revenue/backend/internal/httpapi"
	"gacha-revenue/backend/internal/rankstore"
	"gacha-revenue/backend/internal/revenue"
	"gacha-revenue/backend/internal/security"
	"gacha-revenue/backend/internal/serverlessapi"
)

type localRankReader struct{}

func (localRankReader) QueryRange(context.Context, time.Time, time.Time) ([]rankstore.Snapshot, error) {
	return nil, nil
}

type localRevenueReader struct{}

func (localRevenueReader) List(context.Context) ([]revenue.GameHistory, error) {
	return revenue.Archive(), nil
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	token := os.Getenv("PROXY_TOKEN")
	if !security.ValidProxyToken(token) {
		logger.Error("PROXY_TOKEN must contain 32-256 bytes")
		os.Exit(1)
	}
	address := os.Getenv("BACKEND_ADDRESS")
	if address == "" {
		address = "127.0.0.1:8080"
	}
	host, _, err := net.SplitHostPort(address)
	if err != nil || !net.ParseIP(host).IsLoopback() {
		logger.Error("BACKEND_ADDRESS must use an explicit loopback IP", "address", address)
		os.Exit(1)
	}
	revenueReader := localRevenueReader{}
	fallback := httpapi.NewWithOptions(logger, nil, httpapi.Options{Revenue: revenueReader})
	api := serverlessapi.New(localRankReader{}, fallback, logger, serverlessapi.Options{Revenue: revenueReader})
	handler := security.RequireProxyToken(api, token)
	server := &http.Server{
		Addr: address, Handler: handler,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
	}
	logger.Info("local API listening", "address", address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("local API stopped", "error", err)
		os.Exit(1)
	}
}
