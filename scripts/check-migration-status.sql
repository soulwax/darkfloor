-- File: scripts/check-migration-status.sql
-- Check if migration is running and see table sizes
-- Run this in a separate psql session to monitor progress
-- Check for active locks (migration operations)

SELECT 
  pid,
  usename,
  application_name,
  state,
  query,
  query_start,
  now() - query_start as duration
FROM pg_stat_activity
WHERE query LIKE '%ALTER TABLE%hexmusic-stream%'
   OR query LIKE '%CREATE INDEX%hexmusic-stream%'
ORDER BY query_start;

-- Check table sizes to understand why it might be slow
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE tablename LIKE 'hexmusic-stream_%'
  AND tablename IN (
    'hexmusic-stream_favorite',
    'hexmusic-stream_playlist_track',
    'hexmusic-stream_listening_history',
    'hexmusic-stream_listening_analytics',
    'hexmusic-stream_audio_features',
    'hexmusic-stream_recommendation_cache',
    'hexmusic-stream_playback_state'
  )
ORDER BY size_bytes DESC;

-- Check row counts
SELECT 
  'favorites' as table_name,
  COUNT(*) as row_count
FROM "hexmusic-stream_favorite"
UNION ALL
SELECT 
  'playlist_tracks',
  COUNT(*)
FROM "hexmusic-stream_playlist_track"
UNION ALL
SELECT 
  'listening_history',
  COUNT(*)
FROM "hexmusic-stream_listening_history"
UNION ALL
SELECT 
  'listening_analytics',
  COUNT(*)
FROM "hexmusic-stream_listening_analytics"
UNION ALL
SELECT 
  'audio_features',
  COUNT(*)
FROM "hexmusic-stream_audio_features"
UNION ALL
SELECT 
  'recommendation_cache',
  COUNT(*)
FROM "hexmusic-stream_recommendation_cache"
UNION ALL
SELECT 
  'playback_state',
  COUNT(*)
FROM "hexmusic-stream_playback_state";
