-- File: apps/web/drizzle/0024_spotify_feature_profile.sql

ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "spotifyFeaturesEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "spotifyClientId" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "spotifyClientSecret" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "spotifyUsername" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "spotifySettingsUpdatedAt" timestamp with time zone;
