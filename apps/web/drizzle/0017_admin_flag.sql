-- File: apps/web/drizzle/0017_admin_flag.sql

ALTER TABLE "hexmusic-stream_user" ADD COLUMN "admin" boolean DEFAULT false NOT NULL;
