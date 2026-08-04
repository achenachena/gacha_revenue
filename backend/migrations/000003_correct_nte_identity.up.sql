-- 异环 is Neverness to Everness by Hotta Studio / Perfect World. The earlier
-- seed incorrectly mapped it to NetEase's unrelated ANANTA project.
INSERT INTO games (id, slug, name_zh, name_en, publisher)
VALUES ('nte', 'neverness-to-everness', '异环', 'Neverness to Everness', 'Hotta Studio / Perfect World')
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    publisher = EXCLUDED.publisher,
    updated_at = now();

UPDATE game_platforms SET game_id='nte' WHERE game_id='ananta';
UPDATE source_observations SET game_id='nte' WHERE game_id='ananta';
UPDATE revenue_estimates SET game_id='nte' WHERE game_id='ananta';
UPDATE game_versions SET game_id='nte' WHERE game_id='ananta';
UPDATE ios_rank_snapshots SET game_id='nte' WHERE game_id='ananta';
DELETE FROM games WHERE id='ananta';
