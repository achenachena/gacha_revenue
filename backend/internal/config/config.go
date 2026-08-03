package config

import (
	"fmt"
	"os"
)

type Config struct {
	Address         string
	Environment     string
	DatabaseURL     string
	RedisURL        string
	RawDataBucket   string
	IngestionQueue  string
	CognitoIssuer   string
	CognitoClientID string
	AuthRequired    bool
}

func Load() Config {
	return Config{
		Address:         value("HTTP_ADDRESS", ":8080"),
		Environment:     value("APP_ENV", "development"),
		DatabaseURL:     value("DATABASE_URL", "postgres://gacha:gacha@localhost:5432/gacha?sslmode=disable"),
		RedisURL:        value("REDIS_URL", "redis://localhost:6379/0"),
		RawDataBucket:   value("RAW_DATA_BUCKET", "gacha-revenue-raw-local"),
		IngestionQueue:  value("INGESTION_QUEUE_URL", "http://localhost:4566/000000000000/gacha-ingestion"),
		CognitoIssuer:   os.Getenv("COGNITO_ISSUER"),
		CognitoClientID: os.Getenv("COGNITO_CLIENT_ID"),
		AuthRequired:    os.Getenv("AUTH_REQUIRED") == "true",
	}
}

func (c Config) Validate() error {
	if c.AuthRequired && (c.CognitoIssuer == "" || c.CognitoClientID == "") {
		return fmt.Errorf("COGNITO_ISSUER and COGNITO_CLIENT_ID are required when AUTH_REQUIRED=true")
	}
	return nil
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
