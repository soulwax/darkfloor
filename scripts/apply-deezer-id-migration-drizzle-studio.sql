-- File: scripts/apply-deezer-id-migration-drizzle-studio.sql
-- ============================================
-- Deezer ID Migration Script
-- Run this in Drizzle Studio SQL Console
-- ============================================
-- Step 1: Add deezerId columns to all track-related tables

ALTER TABLE "hexmusic-stream_audio_features" 
ADD COLUMN IF NOT EXISTS "deezerId" bigint;

ALTER TABLE "hexmusic-stream_favorite" 
ADD COLUMN IF NOT EXISTS "deezerId" bigint;

ALTER TABLE "hexmusic-stream_listening_analytics" 
ADD COLUMN IF NOT EXISTS "deezerId" bigint;

ALTER TABLE "hexmusic-stream_listening_history" 
ADD COLUMN IF NOT EXISTS "deezerId" bigint;

ALTER TABLE "hexmusic-stream_playback_state" 
ADD COLUMN IF NOT EXISTS "currentTrackDeezerId" bigint;

ALTER TABLE "hexmusic-stream_playlist_track" 
ADD COLUMN IF NOT EXISTS "deezerId" bigint;

ALTER TABLE "hexmusic-stream_recommendation_cache" 
ADD COLUMN IF NOT EXISTS "seedDeezerId" bigint;

-- Step 2: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS "audio_features_deezer_id_idx" 
ON "hexmusic-stream_audio_features" USING btree ("deezerId");

CREATE INDEX IF NOT EXISTS "favorite_deezer_id_idx" 
ON "hexmusic-stream_favorite" USING btree ("deezerId");

CREATE INDEX IF NOT EXISTS "analytics_deezer_id_idx" 
ON "hexmusic-stream_listening_analytics" USING btree ("deezerId");

CREATE INDEX IF NOT EXISTS "history_deezer_id_idx" 
ON "hexmusic-stream_listening_history" USING btree ("deezerId");

CREATE INDEX IF NOT EXISTS "playback_current_deezer_id_idx" 
ON "hexmusic-stream_playback_state" USING btree ("currentTrackDeezerId");

CREATE INDEX IF NOT EXISTS "playlist_track_deezer_id_idx" 
ON "hexmusic-stream_playlist_track" USING btree ("deezerId");

CREATE INDEX IF NOT EXISTS "rec_cache_seed_deezer_id_idx" 
ON "hexmusic-stream_recommendation_cache" USING btree ("seedDeezerId");

-- Step 3: Mark migration as applied in drizzle's migration tracking table
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL UNIQUE,
  created_at bigint
);

INSERT INTO "__drizzle_migrations" (hash, created_at) 
VALUES ('0016_daffy_shriek', 1768617197783)
ON CONFLICT (hash) DO NOTHING;

-- Step 4: Verify the migration completed successfully
SELECT 
  'Columns added' as check_type,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'hexmusic-stream_%'
  AND column_name IN ('deezerId', 'seedDeezerId', 'currentTrackDeezerId')

UNION ALL

SELECT 
  'Indexes created' as check_type,
  COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'hexmusic-stream_%'
  AND indexname LIKE '%deezer%'

UNION ALL

SELECT 
  'Migration recorded' as check_type,
  COUNT(*) as count
FROM "__drizzle_migrations"
WHERE hash = '0016_daffy_shriek';
