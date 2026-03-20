-- File: apps/web/drizzle/0025_user_language_preference.sql

ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "language" varchar(8) DEFAULT 'en' NOT NULL;
