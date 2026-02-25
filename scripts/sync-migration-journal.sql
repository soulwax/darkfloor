-- File: scripts/sync-migration-journal.sql
-- ============================================
-- Sync Drizzle Migration Journal
-- Run this in Drizzle Studio SQL Console
-- This marks all migrations as applied so drizzle-kit knows the current state
-- ============================================
-- Ensure the migrations tracking table exists

CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL UNIQUE,
  created_at bigint
);

-- Mark all migrations from the journal as applied
-- These match the entries in drizzle/meta/_journal.json
INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES
  ('0000_eager_gideon', 1761660940932),
  ('0001_strange_warlock', 1762209104815),
  ('0002_stiff_the_phantom', 1762273361698),
  ('0003_chemical_mastermind', 1762304917316),
  ('0004_bizarre_violations', 1762311603879),
  ('0005_shocking_korath', 1762433511089),
  ('0006_good_zaran', 1762439527950),
  ('0007_thankful_purifiers', 1762439698829),
  ('0008_luxuriant_smasher', 1762439770023),
  ('0009_tidy_the_call', 1762523513765),
  ('0010_nostalgic_human_cannonball', 1762611491574),
  ('0011_useful_the_enforcers', 1762963675265),
  ('0012_remarkable_ronan', 1764822831151),
  ('0013_outgoing_sumo', 1764928015659),
  ('0014_petite_lady_ursula', 1767159995551),
  ('0015_material_skullbuster', 1768307019710),
  ('0016_daffy_shriek', 1768617197783)
ON CONFLICT (hash) DO NOTHING;

-- Verify all migrations are marked
SELECT 
  hash,
  created_at,
  to_timestamp(created_at / 1000) as applied_at
FROM "__drizzle_migrations"
ORDER BY created_at;

-- Show count
SELECT COUNT(*) as total_migrations_applied FROM "__drizzle_migrations";
