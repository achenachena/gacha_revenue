DROP VIEW IF EXISTS banner_app_line_results;
DROP MATERIALIZED VIEW IF EXISTS banner_app_line_hourly_rollups;
DROP MATERIALIZED VIEW IF EXISTS banner_ios_rank_ranges;
DROP TABLE IF EXISTS banner_app_line_overrides;
DROP INDEX IF EXISTS banners_feed_identity_idx;
ALTER TABLE banners DROP COLUMN IF EXISTS data_status;
ALTER TABLE banners DROP COLUMN IF EXISTS phase_en;
ALTER TABLE banners DROP COLUMN IF EXISTS phase_zh;
DROP TABLE IF EXISTS ios_hourly_rank_snapshots;
