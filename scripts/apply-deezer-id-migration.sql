-- File: scripts/apply-deezer-id-migration.sql
-- Apply deezer_id migration manually
-- Run with: psql $DATABASE_URL -f scripts/apply-deezer-id-migration.sql
-- Or copy-paste into your database client
-- Add deezerId columns

ALTER TABLE "hexmusic-stream_audio_features" ADD COLUMN IF NOT EXISTS "deezerId" bigint;
ALTER TABLE "hexmusic-stream_favorite" ADD COLUMN IF NOT EXISTS "deezerId" bigint;
ALTER TABLE "hexmusic-stream_listening_analytics" ADD COLUMN IF NOT EXISTS "deezerId" bigint;
ALTER TABLE "hexmusic-stream_listening_history" ADD COLUMN IF NOT EXISTS "deezerId" bigint;
ALTER TABLE "hexmusic-stream_playback_state" ADD COLUMN IF NOT EXISTS "currentTrackDeezerId" bigint;
ALTER TABLE "hexmusic-stream_playlist_track" ADD COLUMN IF NOT EXISTS "deezerId" bigint;
ALTER TABLE "hexmusic-stream_recommendation_cache" ADD COLUMN IF NOT EXISTS "seedDeezerId" bigint;

-- Create indexes (will fail silently if they already exist)
CREATE INDEX IF NOT EXISTS "audio_features_deezer_id_idx" ON "hexmusic-stream_audio_features" USING btree ("deezerId");
CREATE INDEX IF NOT EXISTS "favorite_deezer_id_idx" ON "hexmusic-stream_favorite" USING btree ("deezerId");
CREATE INDEX IF NOT EXISTS "analytics_deezer_id_idx" ON "hexmusic-stream_listening_analytics" USING btree ("deezerId");
CREATE INDEX IF NOT EXISTS "history_deezer_id_idx" ON "hexmusic-stream_listening_history" USING btree ("deezerId");
CREATE INDEX IF NOT EXISTS "playback_current_deezer_id_idx" ON "hexmusic-stream_playback_state" USING btree ("currentTrackDeezerId");
CREATE INDEX IF NOT EXISTS "playlist_track_deezer_id_idx" ON "hexmusic-stream_playlist_track" USING btree ("deezerId");
CREATE INDEX IF NOT EXISTS "rec_cache_seed_deezer_id_idx" ON "hexmusic-stream_recommendation_cache" USING btree ("seedDeezerId");

-- Mark the migration as applied in drizzle's migration table
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL UNIQUE,
  created_at bigint
);

INSERT INTO "__drizzle_migrations" (hash, created_at) 
VALUES ('0016_daffy_shriek', 1768617197783)
ON CONFLICT (hash) DO NOTHING;
