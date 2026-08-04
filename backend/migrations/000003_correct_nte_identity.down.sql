INSERT INTO games (id, slug, name_zh, name_en, publisher)
VALUES ('ananta', 'ananta', '异环', 'ANANTA', 'NetEase Games')
ON CONFLICT (id) DO NOTHING;

UPDATE game_platforms SET game_id='ananta' WHERE game_id='nte';
UPDATE source_observations SET game_id='ananta' WHERE game_id='nte';
UPDATE revenue_estimates SET game_id='ananta' WHERE game_id='nte';
UPDATE game_versions SET game_id='ananta' WHERE game_id='nte';
UPDATE ios_rank_snapshots SET game_id='ananta' WHERE game_id='nte';
DELETE FROM games WHERE id='nte';
