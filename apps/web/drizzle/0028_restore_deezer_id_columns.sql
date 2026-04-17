ALTER TABLE "hexmusic-stream_favorite" ADD COLUMN IF NOT EXISTS "deezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorite_deezer_id_idx" ON "hexmusic-stream_favorite" USING btree ("deezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_playlist_track" ADD COLUMN IF NOT EXISTS "deezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlist_track_deezer_id_idx" ON "hexmusic-stream_playlist_track" USING btree ("deezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_listening_history" ADD COLUMN IF NOT EXISTS "deezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_deezer_id_idx" ON "hexmusic-stream_listening_history" USING btree ("deezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_listening_analytics" ADD COLUMN IF NOT EXISTS "deezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_deezer_id_idx" ON "hexmusic-stream_listening_analytics" USING btree ("deezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_audio_features" ADD COLUMN IF NOT EXISTS "deezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audio_features_deezer_id_idx" ON "hexmusic-stream_audio_features" USING btree ("deezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_recommendation_cache" ADD COLUMN IF NOT EXISTS "seedDeezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rec_cache_seed_deezer_id_idx" ON "hexmusic-stream_recommendation_cache" USING btree ("seedDeezerId");--> statement-breakpoint
ALTER TABLE "hexmusic-stream_playback_state" ADD COLUMN IF NOT EXISTS "currentTrackDeezerId" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playback_current_deezer_id_idx" ON "hexmusic-stream_playback_state" USING btree ("currentTrackDeezerId");--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('"hexmusic-stream_favorite"', 'id'),
  COALESCE((SELECT MAX("id") FROM "hexmusic-stream_favorite"), 0) + 1,
  false
);
