package config

import (
	"net"
	"net/url"
	"os"
)

type Config struct {
	Address        string
	Environment    string
	DatabaseURL    string
	RedisURL       string
	RawDataBucket  string
	IngestionQueue string
	RankFeedURL    string
	RankFeedToken  string
}

func Load() Config {
	return Config{
		Address:        value("HTTP_ADDRESS", ":8080"),
		Environment:    value("APP_ENV", "development"),
		DatabaseURL:    databaseURL(),
		RedisURL:       value("REDIS_URL", "redis://localhost:6379/0"),
		RawDataBucket:  value("RAW_DATA_BUCKET", "gacha-revenue-raw-local"),
		IngestionQueue: value("INGESTION_QUEUE_URL", "http://localhost:4566/000000000000/gacha-ingestion"),
		RankFeedURL:    os.Getenv("AUTHORIZED_RANK_FEED_URL"),
		RankFeedToken:  os.Getenv("AUTHORIZED_RANK_FEED_TOKEN"),
	}
}

func databaseURL() string {
	if value := os.Getenv("DATABASE_URL"); value != "" {
		return value
	}
	host := value("PGHOST", "localhost")
	port := value("PGPORT", "5432")
	user := value("PGUSER", "gacha")
	password := value("PGPASSWORD", "gacha")
	database := value("PGDATABASE", "gacha")
	sslMode := value("PGSSLMODE", "disable")
	databaseURL := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   net.JoinHostPort(host, port),
		Path:   "/" + database,
	}
	query := databaseURL.Query()
	query.Set("sslmode", sslMode)
	databaseURL.RawQuery = query.Encode()
	return databaseURL.String()
}

func (c Config) Validate() error { return nil }

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
