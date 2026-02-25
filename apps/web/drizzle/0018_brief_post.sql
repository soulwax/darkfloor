-- File: apps/web/drizzle/0018_brief_post.sql

ALTER TABLE "hexmusic-stream_user_preferences" ADD COLUMN "visualizerMode" varchar(20) DEFAULT 'random';
