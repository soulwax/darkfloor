-- File: apps/web/drizzle/0016_daffy_shriek.sql

ALTER TABLE "hexmusic-stream_audio_features" ADD COLUMN "deezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_favorite" ADD COLUMN "deezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_listening_analytics" ADD COLUMN "deezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_listening_history" ADD COLUMN "deezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_playback_state" ADD COLUMN "currentTrackDeezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_playlist_track" ADD COLUMN "deezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_recommendation_cache" ADD COLUMN "seedDeezerId" bigint;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "keepPlaybackAlive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "audio_features_deezer_id_idx" ON "hexmusic-stream_audio_features" USING btree ("deezerId");--> statement-breakpoint
CREATE INDEX "favorite_deezer_id_idx" ON "hexmusic-stream_favorite" USING btree ("deezerId");--> statement-breakpoint
CREATE INDEX "analytics_deezer_id_idx" ON "hexmusic-stream_listening_analytics" USING btree ("deezerId");--> statement-breakpoint
CREATE INDEX "history_deezer_id_idx" ON "hexmusic-stream_listening_history" USING btree ("deezerId");--> statement-breakpoint
CREATE INDEX "playback_current_deezer_id_idx" ON "hexmusic-stream_playback_state" USING btree ("currentTrackDeezerId");--> statement-breakpoint
CREATE INDEX "playlist_track_deezer_id_idx" ON "hexmusic-stream_playlist_track" USING btree ("deezerId");--> statement-breakpoint
CREATE INDEX "rec_cache_seed_deezer_id_idx" ON "hexmusic-stream_recommendation_cache" USING btree ("seedDeezerId");
