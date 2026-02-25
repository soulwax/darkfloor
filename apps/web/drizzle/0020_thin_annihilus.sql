-- File: apps/web/drizzle/0020_thin_annihilus.sql

ALTER TABLE "hexmusic-stream_user" ADD COLUMN "firstAdmin" boolean DEFAULT false NOT NULL;
