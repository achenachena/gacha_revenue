ALTER TYPE observation_source ADD VALUE IF NOT EXISTS 'apple_public_feed';

-- Prefer licensed history when it overlaps the public Apple collector, so an
-- hour can never be double-counted merely because two providers observed it.
DROP VIEW banner_app_line_results;
DROP MATERIALIZED VIEW banner_app_line_hourly_rollups;
DROP MATERIALIZED VIEW banner_ios_rank_ranges;

CREATE MATERIALIZED VIEW banner_ios_rank_ranges AS
WITH preferred AS (
    SELECT r.*,
           row_number() OVER (
               PARTITION BY r.subject_type, r.subject_id, r.market, r.observed_hour
               ORDER BY CASE r.source::text
                   WHEN 'authorized_rank_feed' THEN 1
                   WHEN 'apple_public_feed' THEN 2
                   ELSE 3
               END
           ) AS precedence
    FROM ios_hourly_rank_snapshots r
)
SELECT
    b.id AS banner_id,
    r.market,
    min(r.grossing_rank) AS peak_rank,
    max(r.grossing_rank) AS lowest_rank,
    count(*) AS observed_hours,
    max(r.observed_hour) AS data_updated_at
FROM banners b
JOIN game_versions v ON v.id = b.version_id
JOIN preferred r
  ON r.subject_type = 'game'
 AND r.subject_id = v.game_id
 AND r.observed_hour >= date_trunc('hour', b.starts_at)
 AND r.observed_hour < date_trunc('hour', b.ends_at)
 AND r.precedence = 1
GROUP BY b.id, r.market;

CREATE UNIQUE INDEX banner_ios_rank_ranges_unique_idx
    ON banner_ios_rank_ranges (banner_id, market);

CREATE MATERIALIZED VIEW banner_app_line_hourly_rollups AS
WITH paired AS (
    SELECT
        b.id AS banner_id,
        a.id AS app_line_id,
        game_rank.observed_hour,
        game_rank.grossing_rank AS game_rank,
        app_rank.grossing_rank AS app_rank,
        game_rank.source,
        b.starts_at,
        b.ends_at,
        row_number() OVER (
            PARTITION BY b.id, a.id, game_rank.observed_hour
            ORDER BY CASE game_rank.source::text
                WHEN 'authorized_rank_feed' THEN 1
                WHEN 'apple_public_feed' THEN 2
                ELSE 3
            END
        ) AS precedence
    FROM banners b
    JOIN game_versions v ON v.id = b.version_id
    CROSS JOIN app_lines a
    JOIN ios_hourly_rank_snapshots game_rank
      ON game_rank.subject_type = 'game'
     AND game_rank.subject_id = v.game_id
     AND game_rank.market = 'CN'
     AND game_rank.observed_hour >= date_trunc('hour', b.starts_at)
     AND game_rank.observed_hour < date_trunc('hour', b.ends_at)
    JOIN ios_hourly_rank_snapshots app_rank
      ON app_rank.subject_type = 'app_line'
     AND app_rank.subject_id = a.id
     AND app_rank.market = 'CN'
     AND app_rank.observed_hour = game_rank.observed_hour
     AND app_rank.source = game_rank.source
), measured AS (
    SELECT * FROM paired WHERE precedence = 1
)
SELECT
    banner_id,
    app_line_id,
    count(*) FILTER (WHERE game_rank < app_rank)::numeric(10, 2) AS hours_above,
    count(*) AS paired_observed_hours,
    extract(epoch FROM (max(ends_at) - min(starts_at))) / 3600 AS expected_hours,
    round(
        count(*)::numeric /
        NULLIF(extract(epoch FROM (max(ends_at) - min(starts_at))) / 3600, 0),
        4
    ) AS coverage_ratio,
    max(observed_hour) AS data_updated_at,
    CASE
        WHEN bool_or(source::text = 'authorized_rank_feed') THEN 'licensed_feed'
        ELSE 'apple_public_feed'
    END AS data_status
FROM measured
GROUP BY banner_id, app_line_id;

CREATE UNIQUE INDEX banner_app_line_hourly_rollups_unique_idx
    ON banner_app_line_hourly_rollups (banner_id, app_line_id);

CREATE VIEW banner_app_line_results AS
SELECT
    b.id AS banner_id,
    a.id AS app_line_id,
    COALESCE(o.hours_above, r.hours_above) AS hours_above,
    r.paired_observed_hours,
    r.expected_hours,
    r.coverage_ratio,
    CASE WHEN o.banner_id IS NOT NULL THEN 'verified_manual' ELSE r.data_status END AS data_status,
    COALESCE(o.corrected_at, r.data_updated_at) AS data_updated_at,
    o.source_note
FROM banners b
CROSS JOIN app_lines a
LEFT JOIN banner_app_line_hourly_rollups r
  ON r.banner_id = b.id AND r.app_line_id = a.id
LEFT JOIN banner_app_line_overrides o
  ON o.banner_id = b.id AND o.app_line_id = a.id
WHERE o.banner_id IS NOT NULL OR r.banner_id IS NOT NULL;
