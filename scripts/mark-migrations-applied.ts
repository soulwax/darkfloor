#!/usr/bin/env tsx
// File: scripts/mark-migrations-applied.ts

/**
 * Script to mark all existing migrations as applied in drizzle.__drizzle_migrations (PostgreSQL).
 * Use when the DB already has the tables (e.g. from db:push or a previous run) but
 * drizzle-kit migrate still tries to run them.
 *
 * For PostgreSQL, drizzle-orm uses schema "drizzle" and stores hash = SHA-256(migration .sql content).
 * Usage: npx tsx scripts/mark-migrations-applied.ts
 */

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
import crypto from "node:crypto";
import { join } from "path";
import { Pool } from "pg";

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";
const DRIZZLE_FOLDER = "apps/web/drizzle";

dotenv.config({ path: ".env.local" });
dotenv.config(); 
function resolveDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined;
}

function getSslConfig(connectionString: string) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(connectionString);
  } catch {
    parsed = null;
  }

  const hostname = parsed?.hostname?.toLowerCase() ?? "";
  const hasExplicitSslMode =
    parsed?.searchParams.has("sslmode") ?? connectionString.includes("sslmode=");

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return undefined;
  }

  const isCloudDb = 
    hostname.includes("aivencloud.com") || 
    hostname.includes("amazonaws.com") ||
    hostname.includes("neon.tech") ||
    hostname.includes("prisma.io");

  if (hasExplicitSslMode) {
    return undefined;
  }

  if (!isCloudDb) {
    return undefined;
  }

    const certPath = join(process.cwd(), "certs/ca.pem");
  
  if (existsSync(certPath)) {
    return {
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ca: readFileSync(certPath).toString(),
    };
  }

    if (process.env.DB_SSL_CA) {
    return {
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ca: process.env.DB_SSL_CA,
    };
  }

    return {
    rejectUnauthorized: false,
  };
}

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    log(
      "❌ DATABASE_URL is required for frontend migration utilities",
      "red",
    );
    process.exit(1);
  }

  log("\n🔧 Marking migrations as applied...\n", "cyan");

  const sslConfig = getSslConfig(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(sslConfig && { ssl: sslConfig }),
  });

  try {
    await pool.query("SELECT 1");
    log("✓ Database connection successful\n", "green");

    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);
    log("✓ Migration tracking table ready (drizzle.__drizzle_migrations)\n", "green");

    const journalPath = join(process.cwd(), DRIZZLE_FOLDER, "meta", "_journal.json");
    const journalContent = await readFile(journalPath, "utf-8");
    const journal = JSON.parse(journalContent) as {
      entries: Array<{ tag: string; when: number }>;
    };

    const migrations = journal.entries ?? [];
    log(`Found ${migrations.length} migrations in journal\n`, "cyan");

    const appliedResult = await pool.query(
      `SELECT hash FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    );
    const appliedHashes = new Set(
      (appliedResult.rows as { hash: string }[]).map((row) => row.hash),
    );

    let marked = 0;
    let skipped = 0;
    const migrationsDir = join(process.cwd(), DRIZZLE_FOLDER);

    for (const entry of migrations) {
      const tag = entry.tag;
      const sqlPath = join(migrationsDir, `${tag}.sql`);
      const query = readFileSync(sqlPath, "utf-8");
      const hash = crypto.createHash("sha256").update(query).digest("hex");
      const createdAt = entry.when ?? Date.now();

      if (appliedHashes.has(hash)) {
        log(`⊘ ${tag} - already marked as applied`, "yellow");
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
        [hash, createdAt],
      );
      appliedHashes.add(hash);
      log(`✓ ${tag} - marked as applied`, "green");
      marked++;
    }

    log(`\n✅ Complete!`, "green");
    log(`   Marked: ${marked} migrations`, "green");
    log(`   Skipped: ${skipped} migrations (already applied)\n`, "green");

    const verifyResult = await pool.query(
      `SELECT COUNT(*) as count FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    );
    const count = (verifyResult.rows[0] as { count: string } | undefined)?.count ?? "0";
    log(`📊 Total migrations in tracking table: ${count}\n`, "cyan");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\n❌ Error: ${message}`, "red");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`Fatal error: ${message}`, "red");
  console.error(err);
  process.exit(1);
});
