-- File: apps/web/drizzle/0016_add_deezer_id_columns.sql
-- Migration: Add deezer_id columns to all tables that store song/track data
-- This ensures deezer_id is available as a dedicated column for querying and indexing
-- Add deezerId to favorites table

ALTER TABLE "hexmusic-stream_favorite" ADD COLUMN "deezerId" bigint;
CREATE INDEX "favorite_deezer_id_idx" ON "hexmusic-stream_favorite" USING btree ("deezerId");

-- Add deezerId to playlist_tracks table
ALTER TABLE "hexmusic-stream_playlist_track" ADD COLUMN "deezerId" bigint;
CREATE INDEX "playlist_track_deezer_id_idx" ON "hexmusic-stream_playlist_track" USING btree ("deezerId");

-- Add deezerId to listening_history table
ALTER TABLE "hexmusic-stream_listening_history" ADD COLUMN "deezerId" bigint;
CREATE INDEX "history_deezer_id_idx" ON "hexmusic-stream_listening_history" USING btree ("deezerId");

-- Add deezerId to listening_analytics table
ALTER TABLE "hexmusic-stream_listening_analytics" ADD COLUMN "deezerId" bigint;
CREATE INDEX "analytics_deezer_id_idx" ON "hexmusic-stream_listening_analytics" USING btree ("deezerId");

-- Add deezerId to audio_features table
ALTER TABLE "hexmusic-stream_audio_features" ADD COLUMN "deezerId" bigint;
CREATE INDEX "audio_features_deezer_id_idx" ON "hexmusic-stream_audio_features" USING btree ("deezerId");

-- Add seedDeezerId to recommendation_cache table
ALTER TABLE "hexmusic-stream_recommendation_cache" ADD COLUMN "seedDeezerId" bigint;
CREATE INDEX "rec_cache_seed_deezer_id_idx" ON "hexmusic-stream_recommendation_cache" USING btree ("seedDeezerId");

-- Add currentTrackDeezerId to playback_state table
ALTER TABLE "hexmusic-stream_playback_state" ADD COLUMN "currentTrackDeezerId" bigint;
CREATE INDEX "playback_current_deezer_id_idx" ON "hexmusic-stream_playback_state" USING btree ("currentTrackDeezerId");
