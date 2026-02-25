-- File: apps/web/drizzle/0019_user_banned.sql

ALTER TABLE "hexmusic-stream_user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;
