package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path"
	"syscall"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gacha-revenue/backend/internal/config"
)

type queueMessage struct {
	Type string `json:"type"`
}

type feedPayload struct {
	Records []rankRecord   `json:"records"`
	Banners []bannerRecord `json:"banners"`
}

type bannerRecord struct {
	GameID      string    `json:"game_id"`
	Version     string    `json:"version"`
	PhaseZh     string    `json:"phase_zh"`
	PhaseEn     string    `json:"phase_en"`
	CharacterZh string    `json:"character_zh"`
	CharacterEn string    `json:"character_en"`
	StartsAt    time.Time `json:"starts_at"`
	EndsAt      time.Time `json:"ends_at"`
}

type rankRecord struct {
	SubjectType  string    `json:"subject_type"`
	SubjectID    string    `json:"subject_id"`
	Market       string    `json:"market"`
	ObservedAt   time.Time `json:"observed_at"`
	GrossingRank int       `json:"grossing_rank"`
	RecordID     string    `json:"record_id"`
}

type worker struct {
	config config.Config
	logger *slog.Logger
	http   *http.Client
	db     *pgxpool.Pool
	sqs    *sqs.Client
	s3     *s3.Client
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if cfg.RankFeedURL == "" || cfg.RankFeedToken == "" {
		logger.Warn("authorized rank feed is not configured; worker will not create synthetic data")
		<-ctx.Done()
		return
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("load AWS configuration", "error", err)
		return
	}
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("connect postgres", "error", err)
		return
	}
	defer db.Close()

	w := &worker{
		config: cfg,
		logger: logger,
		http:   &http.Client{Timeout: 45 * time.Second},
		db:     db,
		sqs:    sqs.NewFromConfig(awsCfg),
		s3:     s3.NewFromConfig(awsCfg),
	}
	logger.Info("authorized ingestion worker ready", "queue", cfg.IngestionQueue, "bucket", cfg.RawDataBucket)
	if err := w.run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		logger.Error("worker stopped", "error", err)
	}
}

func (w *worker) run(ctx context.Context) error {
	for ctx.Err() == nil {
		output, err := w.sqs.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl:            &w.config.IngestionQueue,
			MaxNumberOfMessages: 5,
			WaitTimeSeconds:     20,
			VisibilityTimeout:   180,
		})
		if err != nil {
			w.logger.Error("receive ingestion messages", "error", err)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(5 * time.Second):
				continue
			}
		}
		for _, message := range output.Messages {
			if message.Body == nil || message.ReceiptHandle == nil {
				continue
			}
			var job queueMessage
			if err := json.Unmarshal([]byte(*message.Body), &job); err != nil {
				w.logger.Error("invalid queue message", "error", err)
				continue
			}
			if job.Type != "hourly_rank_refresh" && job.Type != "scheduled_full_refresh" {
				w.logger.Warn("unknown ingestion job", "type", job.Type)
				continue
			}
			if err := w.ingestRankFeed(ctx); err != nil {
				w.logger.Error("rank ingestion failed; message retained for retry", "error", err)
				continue
			}
			_, err := w.sqs.DeleteMessage(ctx, &sqs.DeleteMessageInput{QueueUrl: &w.config.IngestionQueue, ReceiptHandle: message.ReceiptHandle})
			if err != nil {
				w.logger.Error("delete completed message", "error", err)
			}
		}
	}
	return ctx.Err()
}

func (w *worker) ingestRankFeed(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, w.config.RankFeedURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+w.config.RankFeedToken)
	request.Header.Set("Accept", "application/json")
	response, err := w.http.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64<<20))
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("rank feed returned HTTP %d", response.StatusCode)
	}

	var payload feedPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("decode rank feed: %w", err)
	}
	for index, record := range payload.Records {
		if err := validateRecord(record); err != nil {
			return fmt.Errorf("record %d: %w", index, err)
		}
	}
	for index, banner := range payload.Banners {
		if err := validateBanner(banner); err != nil {
			return fmt.Errorf("banner %d: %w", index, err)
		}
	}

	digest := sha256.Sum256(body)
	checksum := hex.EncodeToString(digest[:])
	objectKey := path.Join("authorized-rank-feed", time.Now().UTC().Format("2006/01/02/15"), checksum+".json")
	if _, err := w.s3.PutObject(ctx, &s3.PutObjectInput{Bucket: &w.config.RawDataBucket, Key: &objectKey, Body: bytes.NewReader(body), ContentType: pointer("application/json")}); err != nil {
		return fmt.Errorf("archive licensed payload: %w", err)
	}

	tx, err := w.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var runID string
	err = tx.QueryRow(ctx, `
		INSERT INTO ingestion_runs (source, raw_object_key, source_checksum, status, started_at)
		VALUES ('authorized_rank_feed', $1, $2, 'running', now())
		ON CONFLICT (source, source_checksum) DO NOTHING
		RETURNING id`, objectKey, checksum).Scan(&runID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	for _, banner := range payload.Banners {
		var versionID string
		err = tx.QueryRow(ctx, `
			INSERT INTO game_versions (game_id, version, starts_at, ends_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (game_id, version) DO UPDATE SET
			  starts_at=LEAST(game_versions.starts_at, EXCLUDED.starts_at),
			  ends_at=GREATEST(game_versions.ends_at, EXCLUDED.ends_at)
			RETURNING id`, banner.GameID, banner.Version, banner.StartsAt, banner.EndsAt).Scan(&versionID)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO banners
			(version_id, name_zh, name_en, characters, starts_at, ends_at, phase_zh, phase_en, data_status)
			VALUES ($1, $2, $3, jsonb_build_object('zh-CN', $2::text, 'en', $3::text), $4, $5, $6, $7, 'licensed_feed')
			ON CONFLICT (version_id, starts_at, ends_at, name_zh) DO UPDATE SET
			  name_en=EXCLUDED.name_en,
			  characters=EXCLUDED.characters,
			  phase_zh=EXCLUDED.phase_zh,
			  phase_en=EXCLUDED.phase_en,
			  data_status='licensed_feed'`,
			versionID, banner.CharacterZh, banner.CharacterEn, banner.StartsAt, banner.EndsAt, banner.PhaseZh, banner.PhaseEn)
		if err != nil {
			return err
		}
	}
	for _, record := range payload.Records {
		hour := record.ObservedAt.UTC().Truncate(time.Hour)
		_, err = tx.Exec(ctx, `
			INSERT INTO ios_hourly_rank_snapshots
			(subject_type, subject_id, market, observed_hour, grossing_rank, source, ingestion_run_id, feed_record_id)
			VALUES ($1, $2, $3, $4, $5, 'authorized_rank_feed', $6, $7)
			ON CONFLICT (subject_type, subject_id, market, observed_hour, source)
			DO UPDATE SET grossing_rank = EXCLUDED.grossing_rank,
			              ingestion_run_id = EXCLUDED.ingestion_run_id,
			              feed_record_id = EXCLUDED.feed_record_id`,
			record.SubjectType, record.SubjectID, record.Market, hour, record.GrossingRank, runID, record.RecordID)
		if err != nil {
			return err
		}
	}
	totalRecords := len(payload.Records) + len(payload.Banners)
	_, err = tx.Exec(ctx, `UPDATE ingestion_runs SET status='succeeded', records_read=$2, records_written=$2, finished_at=now() WHERE id=$1`, runID, totalRecords)
	if err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if _, err := w.db.Exec(ctx, `REFRESH MATERIALIZED VIEW CONCURRENTLY banner_ios_rank_ranges`); err != nil {
		return err
	}
	if _, err := w.db.Exec(ctx, `REFRESH MATERIALIZED VIEW CONCURRENTLY banner_app_line_hourly_rollups`); err != nil {
		return err
	}
	w.logger.Info("rank feed ingested", "rank_records", len(payload.Records), "banners", len(payload.Banners), "checksum", checksum)
	return nil
}

func validateRecord(record rankRecord) error {
	if record.SubjectType != "game" && record.SubjectType != "app_line" {
		return fmt.Errorf("invalid subject_type %q", record.SubjectType)
	}
	if record.SubjectID == "" || record.RecordID == "" || record.ObservedAt.IsZero() {
		return errors.New("subject_id, record_id, and observed_at are required")
	}
	if record.Market != "CN" && record.Market != "JP" && record.Market != "US" && record.Market != "KR" {
		return fmt.Errorf("invalid market %q", record.Market)
	}
	if record.GrossingRank < 1 {
		return errors.New("grossing_rank must be positive")
	}
	return nil
}

func validateBanner(banner bannerRecord) error {
	if banner.GameID == "" || banner.Version == "" || banner.CharacterZh == "" || banner.CharacterEn == "" {
		return errors.New("game_id, version, character_zh, and character_en are required")
	}
	if banner.StartsAt.IsZero() || banner.EndsAt.IsZero() || !banner.EndsAt.After(banner.StartsAt) {
		return errors.New("banner starts_at and a later ends_at are required")
	}
	return nil
}

func pointer(value string) *string { return &value }
