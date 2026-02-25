-- File: apps/web/drizzle/0021_unique_first_admin.sql

CREATE UNIQUE INDEX "unique_first_admin"
  ON "hexmusic-stream_user" ("firstAdmin")
  WHERE "firstAdmin" = true;
