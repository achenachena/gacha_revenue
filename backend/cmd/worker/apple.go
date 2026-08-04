package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5"
)

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

type appleSnapshot struct {
	Market    string         `json:"market"`
	SourceURL string         `json:"source_url"`
	Ranks     map[string]int `json:"ranks"`
}

type appleArchive struct {
	ObservedHour time.Time       `json:"observed_hour"`
	CapturedAt   time.Time       `json:"captured_at"`
	Snapshots    []appleSnapshot `json:"snapshots"`
}

var appleGameIDs = map[string]map[string]string{
	"genshin":  {"CN": "1467190251", "JP": "1517783697", "US": "1517783697", "KR": "1517783697"},
	"hsr":      {"CN": "1523037824", "JP": "1599719154", "US": "1599719154", "KR": "1599719154"},
	"zzz":      {"CN": "1606359076", "JP": "1606356401", "US": "1606356401", "KR": "1606356401"},
	"wuwa":     {"CN": "6450693428", "JP": "6475033368", "US": "6475033368", "KR": "6475033368"},
	"endfield": {"CN": "6753859465", "JP": "6752642477", "US": "6752642477", "KR": "6752642477"},
	"nte":      {"CN": "6514281568", "JP": "6754593077", "US": "6754593077", "KR": "6754593077"},
}

var appleAppLineIDs = map[string]string{
	"douyin": "1142110895", "tencent_video": "458318329", "qq_music": "414603431",
	"capcut_cn": "1458072671", "netease_music": "590338362", "baidu_netdisk": "547166701", "quark": "1160172628",
}

func (w *worker) ingestAppleRanks(ctx context.Context) error {
	observedHour := time.Now().UTC().Truncate(time.Hour)
	archive := appleArchive{ObservedHour: observedHour, CapturedAt: time.Now().UTC()}
	for _, market := range []string{"CN", "JP", "US", "KR"} {
		country := map[string]string{"CN": "cn", "JP": "jp", "US": "us", "KR": "kr"}[market]
		sourceURL := fmt.Sprintf("https://itunes.apple.com/%s/rss/topgrossingapplications/limit=200/json", country)
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
		if err != nil {
			return err
		}
		request.Header.Set("User-Agent", "gacha-revenue-observatory/1.0")
		response, err := w.http.Do(request)
		if err != nil {
			return err
		}
		var payload appleFeed
		decodeErr := json.NewDecoder(response.Body).Decode(&payload)
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return fmt.Errorf("Apple %s feed returned HTTP %d", market, response.StatusCode)
		}
		if decodeErr != nil {
			return fmt.Errorf("decode Apple %s feed: %w", market, decodeErr)
		}
		ranks := make(map[string]int, len(payload.Feed.Entries))
		for index, entry := range payload.Feed.Entries {
			if entry.ID.Attributes.StoreID != "" {
				ranks[entry.ID.Attributes.StoreID] = index + 1
			}
		}
		archive.Snapshots = append(archive.Snapshots, appleSnapshot{Market: market, SourceURL: sourceURL, Ranks: ranks})
	}

	body, err := json.Marshal(archive)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(body)
	checksum := hex.EncodeToString(digest[:])
	objectKey := path.Join("apple-public-ranks", observedHour.Format("2006/01/02/15"), checksum+".json")
	if _, err := w.s3.PutObject(ctx, &s3.PutObjectInput{Bucket: &w.config.RawDataBucket, Key: &objectKey, Body: bytes.NewReader(body), ContentType: pointer("application/json")}); err != nil {
		return fmt.Errorf("archive Apple payload: %w", err)
	}

	tx, err := w.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var runID string
	err = tx.QueryRow(ctx, `
		INSERT INTO ingestion_runs (source, raw_object_key, source_checksum, status, started_at)
		VALUES ('apple_public_feed', $1, $2, 'running', now())
		ON CONFLICT (source, source_checksum) DO NOTHING RETURNING id`, objectKey, checksum).Scan(&runID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return err
	}
	written := 0
	gameIDs := sortedKeys(appleGameIDs)
	lineIDs := sortedKeys(appleAppLineIDs)
	for _, snapshot := range archive.Snapshots {
		for _, gameID := range gameIDs {
			storeID := appleGameIDs[gameID][snapshot.Market]
			rank, present := snapshot.Ranks[storeID]
			if !present {
				continue
			}
			if err := insertAppleRank(ctx, tx, runID, "game", gameID, snapshot.Market, observedHour, rank); err != nil {
				return err
			}
			written++
		}
		if snapshot.Market == "CN" {
			for _, lineID := range lineIDs {
				rank, present := snapshot.Ranks[appleAppLineIDs[lineID]]
				if !present {
					continue
				}
				if err := insertAppleRank(ctx, tx, runID, "app_line", lineID, snapshot.Market, observedHour, rank); err != nil {
					return err
				}
				written++
			}
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE ingestion_runs SET status='succeeded', records_read=$2, records_written=$2, finished_at=now() WHERE id=$1`, runID, written); err != nil {
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
	w.logger.Info("Apple public ranks ingested", "records", written, "observed_hour", observedHour, "checksum", checksum)
	return nil
}

func insertAppleRank(ctx context.Context, tx pgx.Tx, runID, subjectType, subjectID, market string, observedHour time.Time, rank int) error {
	feedID := fmt.Sprintf("apple:%s:%s:%s:%s", market, subjectType, subjectID, observedHour.Format(time.RFC3339))
	_, err := tx.Exec(ctx, `
		INSERT INTO ios_hourly_rank_snapshots
		(subject_type, subject_id, market, observed_hour, grossing_rank, source, ingestion_run_id, feed_record_id)
		VALUES ($1, $2, $3, $4, $5, 'apple_public_feed', $6, $7)
		ON CONFLICT (subject_type, subject_id, market, observed_hour, source)
		DO UPDATE SET grossing_rank=EXCLUDED.grossing_rank, ingestion_run_id=EXCLUDED.ingestion_run_id, feed_record_id=EXCLUDED.feed_record_id`,
		subjectType, subjectID, market, observedHour, rank, runID, feedID)
	return err
}

func sortedKeys[V any](values map[string]V) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
