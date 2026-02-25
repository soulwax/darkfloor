#!/bin/bash
# File: scripts/check-migration-progress.sh

echo "Checking if migration is still running..."
psql $DATABASE_URL_UNPOOLED <<EOF
-- Check for active ALTER TABLE or CREATE INDEX operations
SELECT 
  pid,
  usename,
  state,
  LEFT(query, 80) as query_preview,
  now() - query_start as duration,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE (query LIKE '%ALTER TABLE%hexmusic-stream%'
   OR query LIKE '%CREATE INDEX%hexmusic-stream%')
  AND state != 'idle'
ORDER BY query_start;

-- Check which columns already exist
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'hexmusic-stream_%'
  AND column_name IN ('deezerId', 'seedDeezerId', 'currentTrackDeezerId')
ORDER BY table_name, column_name;

-- Check which indexes already exist
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'hexmusic-stream_%'
  AND indexname LIKE '%deezer%'
ORDER BY tablename, indexname;
EOF
