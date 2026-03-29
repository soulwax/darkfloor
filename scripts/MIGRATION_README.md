# Database Migration to Managed PostgreSQL

This guide explains how to migrate your database from your current PostgreSQL instance to a managed PostgreSQL target such as Prisma Postgres.

## Prerequisites

1. **Ensure schema exists on target database**: Before migrating data, create the schema on the target database. Run:

```bash
# Set your target database URL temporarily
export DATABASE_URL="postgres://token:secret@db.prisma.io:5432/postgres?sslmode=require"

# Push schema to the target
pnpm drizzle-kit push --config apps/web/drizzle.config.cjs
```

2. **Backup your current database**: Always backup before migration!

```bash
# Using pg_dump (recommended)
pg_dump $SOURCE_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Migration Steps

### Option 1: Using the TypeScript Migration Script (Recommended)

The migration script (`migrate-to-neon.ts`) provides:
- ✅ Automatic table discovery
- ✅ Foreign key dependency handling
- ✅ Progress tracking
- ✅ Data verification
- ✅ Error handling

**Usage:**

```bash
# Set source + target
export OLD_DATABASE_URL="postgresql://source-user:pass@source-host/db"
export NEW_DATABASE_URL="postgresql://target-user:pass@target-host/db"
# (UNPOOLED variants optional; preferred for large parallel migrations)

# Run migration with defaults (append mode + verification)
pnpm migrate:neon
```

**Useful options:**

```bash
# Plan only (no writes)
pnpm migrate:neon -- --dry-run

# Skip tables that already have target rows
pnpm migrate:neon -- --existing=skip-table --skip-confirm

# Force target tables to mirror source (truncate before copy)
pnpm migrate:neon -- --existing=truncate --skip-confirm

# Restrict or exclude tables
pnpm migrate:neon -- --only-tables=hexmusic-stream_user,hexmusic-stream_session
pnpm migrate:neon -- --skip-tables=hexmusic-stream_search_history

# Tune write batch size and skip verification if desired
pnpm migrate:neon -- --batch-size=2000 --no-verify
```

**CLI help:**
```bash
pnpm migrate:neon -- --help
```

### Option 2: Using pg_dump and pg_restore (Alternative)

For very large databases, `pg_dump`/`pg_restore` might be faster:

```bash
# 1. Dump schema only (if not already done)
pg_dump $SOURCE_DATABASE_URL --schema-only > schema.sql

# 2. Apply schema to target
psql $TARGET_DATABASE_URL < schema.sql

# 3. Dump data only
pg_dump $SOURCE_DATABASE_URL --data-only --disable-triggers > data.sql

# 4. Restore data to target
psql $TARGET_DATABASE_URL < data.sql
```

Or in one command:

```bash
pg_dump $SOURCE_DATABASE_URL | psql $TARGET_DATABASE_URL
```

## Post-Migration

1. **Update your environment variables** to point to the new database:

```bash
# Update .env.local
DATABASE_URL="postgres://token:secret@db.prisma.io:5432/postgres?sslmode=require"
# Optional aliases also supported:
# PRISMA_DATABASE_URL="${DATABASE_URL}"
# POSTGRES_PRISMA_URL="${DATABASE_URL}"
```

2. **Test the connection:**

```bash
npm run db:studio
```

3. **Verify data integrity:**

The migration script automatically verifies row counts. You can also manually check:

```sql
-- Compare row counts
SELECT 
  'users' as table_name,
  (SELECT COUNT(*) FROM "hexmusic-stream_user") as row_count
UNION ALL
SELECT 'playlists', (SELECT COUNT(*) FROM "hexmusic-stream_playlist")
-- ... etc
```

## Troubleshooting

### SSL Certificate Issues

If you encounter SSL errors, managed PostgreSQL URLs with explicit `sslmode=...` are used as-is. For certificate-based setups without explicit SSL mode, you may need to:

1. Set `DB_SSL_CA` environment variable with your CA certificate
2. Or place your CA certificate at `certs/ca.pem`

### Connection Timeouts

For large databases, you may need to increase connection timeouts. Edit the script to adjust:

```typescript
const sourcePool = new Pool({
  connectionString: sourceUrl,
  ssl: sourceSsl,
  max: 5,
  connectionTimeoutMillis: 60000, // Increase if needed
});
```

### Foreign Key Violations

If you see foreign key violations, the script handles table ordering automatically. If issues persist:

1. Temporarily disable foreign key checks (not recommended for production)
2. Or migrate in smaller batches

### Sequence Issues

The script automatically resets sequences after migration. If you see ID conflicts:

```sql
-- Manually reset sequences
SELECT setval('hexmusic-stream_playlist_id_seq', (SELECT MAX(id) FROM "hexmusic-stream_playlist"));
```

## Notes

- The migration script preserves all data including indexes and constraints
- Sequences are automatically reset to prevent ID conflicts
- The script uses transactions for data integrity
- Large tables are migrated in batches of 1000 rows for better performance
- The `pnpm migrate:neon` command name is kept for compatibility even when the target is Prisma Postgres
