CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE observation_source AS ENUM ('sensor_tower', 'appmagic', 'authorized_rank_feed', 'exchange_rate_api', 'manual_public_disclosure');
CREATE TYPE estimate_grain AS ENUM ('day', 'month', 'year', 'version', 'banner');
CREATE TYPE confidence_grade AS ENUM ('A', 'B_PLUS', 'B', 'C', 'NA');

CREATE TABLE games (
    id text PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    name_zh text NOT NULL,
    name_en text NOT NULL,
    publisher text NOT NULL,
    commercialized_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_platforms (
    game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    platform text NOT NULL,
    market text NOT NULL,
    available_from date,
    PRIMARY KEY (game_id, platform, market)
);

CREATE TABLE ingestion_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source observation_source NOT NULL,
    raw_object_key text,
    source_checksum text NOT NULL,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead_lettered')),
    records_read integer NOT NULL DEFAULT 0,
    records_written integer NOT NULL DEFAULT 0,
    error_message text,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source, source_checksum)
);

CREATE TABLE source_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id),
    source observation_source NOT NULL,
    game_id text NOT NULL REFERENCES games(id),
    market text NOT NULL,
    platform text NOT NULL,
    observed_at timestamptz NOT NULL,
    metric text NOT NULL,
    value numeric(20, 6) NOT NULL,
    currency char(3),
    source_record_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source, source_record_id, metric)
);

CREATE INDEX source_observations_lookup_idx
    ON source_observations (game_id, metric, observed_at DESC);

CREATE TABLE fx_rates (
    rate_date date NOT NULL,
    base_currency char(3) NOT NULL,
    quote_currency char(3) NOT NULL,
    rate numeric(20, 10) NOT NULL,
    source text NOT NULL,
    PRIMARY KEY (rate_date, base_currency, quote_currency)
);

CREATE TABLE model_versions (
    id text PRIMARY KEY,
    formula text NOT NULL,
    coefficients jsonb NOT NULL,
    activated_at timestamptz NOT NULL,
    retired_at timestamptz,
    created_by text NOT NULL
);

CREATE TABLE revenue_estimates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id text NOT NULL REFERENCES games(id),
    grain estimate_grain NOT NULL,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    estimate_cny numeric(20, 2) NOT NULL,
    p25_cny numeric(20, 2) NOT NULL,
    p75_cny numeric(20, 2) NOT NULL,
    confidence confidence_grade NOT NULL,
    model_version_id text NOT NULL REFERENCES model_versions(id),
    input_manifest jsonb NOT NULL,
    calculated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (game_id, grain, period_start, model_version_id)
);

CREATE INDEX revenue_estimates_query_idx
    ON revenue_estimates (game_id, grain, period_start DESC);

CREATE TABLE game_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id text NOT NULL REFERENCES games(id),
    version text NOT NULL,
    name_zh text,
    name_en text,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    UNIQUE (game_id, version)
);

CREATE TABLE banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES game_versions(id) ON DELETE CASCADE,
    name_zh text NOT NULL,
    name_en text NOT NULL,
    characters jsonb NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL
);

CREATE TABLE ios_rank_snapshots (
    game_id text NOT NULL REFERENCES games(id),
    market text NOT NULL,
    observed_at timestamptz NOT NULL,
    grossing_rank integer NOT NULL CHECK (grossing_rank > 0),
    feed_record_id text NOT NULL,
    PRIMARY KEY (game_id, market, observed_at)
);

CREATE INDEX ios_rank_snapshots_range_idx
    ON ios_rank_snapshots (game_id, market, grossing_rank, observed_at);

CREATE TABLE app_lines (
    id text PRIMARY KEY,
    name_zh text NOT NULL,
    name_en text NOT NULL,
    ios_store_id text NOT NULL UNIQUE
);

CREATE TABLE version_app_line_hours (
    version_id uuid NOT NULL REFERENCES game_versions(id) ON DELETE CASCADE,
    app_line_id text NOT NULL REFERENCES app_lines(id),
    hours_above numeric(10, 2) NOT NULL CHECK (hours_above >= 0),
    calculated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (version_id, app_line_id)
);

CREATE TABLE audit_events (
    id bigserial PRIMARY KEY,
    actor_sub text NOT NULL,
    actor_role text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_lines (id, name_zh, name_en, ios_store_id) VALUES
    ('douyin', '抖音', 'Douyin', '1142110895'),
    ('tencent_video', '腾讯视频', 'Tencent Video', '458318329'),
    ('qq_music', 'QQ音乐', 'QQ Music', '414603431'),
    ('capcut_cn', '剪映', 'CapCut CN', '1458072671'),
    ('netease_music', '网易云音乐', 'NetEase Cloud Music', '590338362'),
    ('baidu_netdisk', '百度网盘', 'Baidu Netdisk', '547166701'),
    ('quark', '夸克网盘', 'Quark', '1160172628');

