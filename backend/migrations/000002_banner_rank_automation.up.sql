-- Rank data is normalized to one observation per UTC hour. Both the game and
-- each comparison app must be present for an hour to be counted.
CREATE TABLE ios_hourly_rank_snapshots (
    subject_type text NOT NULL CHECK (subject_type IN ('game', 'app_line')),
    subject_id text NOT NULL,
    market text NOT NULL CHECK (market IN ('CN', 'JP', 'US', 'KR')),
    observed_hour timestamptz NOT NULL,
    grossing_rank integer NOT NULL CHECK (grossing_rank > 0),
    source observation_source NOT NULL,
    ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id),
    feed_record_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observed_hour = date_trunc('hour', observed_hour)),
    PRIMARY KEY (subject_type, subject_id, market, observed_hour, source)
);

CREATE INDEX ios_hourly_rank_subject_window_idx
    ON ios_hourly_rank_snapshots (subject_type, subject_id, market, observed_hour, grossing_rank);

ALTER TABLE banners
    ADD COLUMN phase_zh text,
    ADD COLUMN phase_en text,
    ADD COLUMN data_status text NOT NULL DEFAULT 'licensed_feed'
        CHECK (data_status IN ('licensed_feed', 'verified_manual', 'awaiting_feed'));

CREATE UNIQUE INDEX banners_feed_identity_idx
    ON banners (version_id, starts_at, ends_at, name_zh);

INSERT INTO games (id, slug, name_zh, name_en, publisher) VALUES
    ('genshin', 'genshin-impact', '原神', 'Genshin Impact', 'HoYoverse'),
    ('hsr', 'honkai-star-rail', '崩坏：星穹铁道', 'Honkai: Star Rail', 'HoYoverse'),
    ('zzz', 'zenless-zone-zero', '绝区零', 'Zenless Zone Zero', 'HoYoverse'),
    ('wuwa', 'wuthering-waves', '鸣潮', 'Wuthering Waves', 'Kuro Games'),
    ('endfield', 'arknights-endfield', '明日方舟：终末地', 'Arknights: Endfield', 'GRYPHLINE'),
    ('ananta', 'ananta', '异环', 'ANANTA', 'NetEase Games')
ON CONFLICT (id) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    publisher = EXCLUDED.publisher,
    updated_at = now();

CREATE TABLE banner_app_line_overrides (
    banner_id uuid NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    app_line_id text NOT NULL REFERENCES app_lines(id),
    hours_above numeric(10, 2) NOT NULL CHECK (hours_above >= 0),
    source_note text NOT NULL,
    corrected_by text NOT NULL,
    corrected_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (banner_id, app_line_id)
);

INSERT INTO game_versions (game_id, version, starts_at, ends_at) VALUES
    ('wuwa', '2.4', '2025-06-12 00:00:00+00', '2025-07-24 00:00:00+00'),
    ('wuwa', '3.1', '2026-02-05 00:00:00+00', '2026-03-19 00:00:00+00'),
    ('hsr', '3.2', '2025-04-09 00:00:00+00', '2025-05-21 00:00:00+00')
ON CONFLICT (game_id, version) DO NOTHING;

INSERT INTO banners (version_id, name_zh, name_en, characters, starts_at, ends_at, phase_zh, phase_en, data_status)
SELECT id, '卡提希娅', 'Cartethyia', '{"zh-CN":"卡提希娅","en":"Cartethyia"}'::jsonb,
       '2025-06-12 00:00:00+00', '2025-07-03 00:00:00+00', '卡提希娅卡池', 'Cartethyia banner', 'verified_manual'
FROM game_versions WHERE game_id='wuwa' AND version='2.4'
ON CONFLICT (version_id, starts_at, ends_at, name_zh) DO NOTHING;

INSERT INTO banners (version_id, name_zh, name_en, characters, starts_at, ends_at, phase_zh, phase_en, data_status)
SELECT id, '爱弥斯', 'Aemeath', '{"zh-CN":"爱弥斯","en":"Aemeath"}'::jsonb,
       '2026-02-05 00:00:00+00', '2026-02-26 00:00:00+00', '爱弥斯卡池', 'Aemeath banner', 'verified_manual'
FROM game_versions WHERE game_id='wuwa' AND version='3.1'
ON CONFLICT (version_id, starts_at, ends_at, name_zh) DO NOTHING;

INSERT INTO banners (version_id, name_zh, name_en, characters, starts_at, ends_at, phase_zh, phase_en, data_status)
SELECT id, '那刻夏', 'Anaxa', '{"zh-CN":"那刻夏","en":"Anaxa"}'::jsonb,
       '2025-04-30 00:00:00+00', '2025-05-21 00:00:00+00', '下半卡池', 'Phase 2 banner', 'verified_manual'
FROM game_versions WHERE game_id='hsr' AND version='3.2'
ON CONFLICT (version_id, starts_at, ends_at, name_zh) DO NOTHING;

INSERT INTO banner_app_line_overrides (banner_id, app_line_id, hours_above, source_note, corrected_by)
SELECT b.id, 'tencent_video', 18, 'Product owner correction: 2.4 卡提希娅超腾讯视频 18h', 'product_owner'
FROM banners b JOIN game_versions v ON v.id=b.version_id
WHERE v.game_id='wuwa' AND v.version='2.4' AND b.name_zh='卡提希娅'
ON CONFLICT (banner_id, app_line_id) DO UPDATE SET hours_above=EXCLUDED.hours_above, source_note=EXCLUDED.source_note;

INSERT INTO banner_app_line_overrides (banner_id, app_line_id, hours_above, source_note, corrected_by)
SELECT b.id, 'tencent_video', 15, 'Product owner correction: 3.1 爱弥斯超腾讯视频 15h', 'product_owner'
FROM banners b JOIN game_versions v ON v.id=b.version_id
WHERE v.game_id='wuwa' AND v.version='3.1' AND b.name_zh='爱弥斯'
ON CONFLICT (banner_id, app_line_id) DO UPDATE SET hours_above=EXCLUDED.hours_above, source_note=EXCLUDED.source_note;

INSERT INTO banner_app_line_overrides (banner_id, app_line_id, hours_above, source_note, corrected_by)
SELECT b.id, 'douyin', 0, 'Product owner correction: 那刻夏未超过抖音', 'product_owner'
FROM banners b JOIN game_versions v ON v.id=b.version_id
WHERE v.game_id='hsr' AND v.version='3.2' AND b.name_zh='那刻夏'
ON CONFLICT (banner_id, app_line_id) DO UPDATE SET hours_above=EXCLUDED.hours_above, source_note=EXCLUDED.source_note;

CREATE MATERIALIZED VIEW banner_ios_rank_ranges AS
SELECT
    b.id AS banner_id,
    r.market,
    min(r.grossing_rank) AS peak_rank,
    max(r.grossing_rank) AS lowest_rank,
    count(*) AS observed_hours,
    max(r.observed_hour) AS data_updated_at
FROM banners b
JOIN game_versions v ON v.id = b.version_id
JOIN ios_hourly_rank_snapshots r
  ON r.subject_type = 'game'
 AND r.subject_id = v.game_id
 AND r.observed_hour >= date_trunc('hour', b.starts_at)
 AND r.observed_hour < date_trunc('hour', b.ends_at)
GROUP BY b.id, r.market;

CREATE UNIQUE INDEX banner_ios_rank_ranges_unique_idx
    ON banner_ios_rank_ranges (banner_id, market);

CREATE MATERIALIZED VIEW banner_app_line_hourly_rollups AS
WITH measured AS (
    SELECT
        b.id AS banner_id,
        a.id AS app_line_id,
        game_rank.observed_hour,
        game_rank.grossing_rank AS game_rank,
        app_rank.grossing_rank AS app_rank,
        game_rank.source,
        b.starts_at,
        b.ends_at
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
    max(observed_hour) AS data_updated_at
FROM measured
GROUP BY banner_id, app_line_id;

CREATE UNIQUE INDEX banner_app_line_hourly_rollups_unique_idx
    ON banner_app_line_hourly_rollups (banner_id, app_line_id);

-- The API reads this view. A manual correction is visible, but is labelled and
-- never silently mixed with licensed-feed output.
CREATE VIEW banner_app_line_results AS
SELECT
    b.id AS banner_id,
    a.id AS app_line_id,
    COALESCE(o.hours_above, r.hours_above) AS hours_above,
    r.paired_observed_hours,
    r.expected_hours,
    r.coverage_ratio,
    CASE WHEN o.banner_id IS NOT NULL THEN 'verified_manual' ELSE 'licensed_feed' END AS data_status,
    COALESCE(o.corrected_at, r.data_updated_at) AS data_updated_at,
    o.source_note
FROM banners b
CROSS JOIN app_lines a
LEFT JOIN banner_app_line_hourly_rollups r
  ON r.banner_id = b.id AND r.app_line_id = a.id
LEFT JOIN banner_app_line_overrides o
  ON o.banner_id = b.id AND o.app_line_id = a.id
WHERE o.banner_id IS NOT NULL OR r.banner_id IS NOT NULL;
