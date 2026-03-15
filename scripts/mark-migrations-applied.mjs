#!/usr/bin/env node
// File: scripts/mark-migrations-applied.mjs

/**
 * Script to mark all existing migrations as applied in drizzle.__drizzle_migrations (PostgreSQL).
 * Use when the DB already has the tables (e.g. from db:push or a previous run) but
 * drizzle-kit migrate still tries to run them.
 *
 * For PostgreSQL, drizzle-orm uses schema "drizzle" and stores hash = SHA-256(migration .sql content).
 * Usage: node scripts/mark-migrations-applied.mjs
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

function getSslConfig(connectionString) {
  if (connectionString.includes("neon.tech")) {
    return undefined;
  }

  const isCloudDb =
    connectionString.includes("aivencloud.com") ||
    connectionString.includes("rds.amazonaws.com") ||
    connectionString.includes("sslmode=");

  if (!isCloudDb && connectionString.includes("localhost")) {
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

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log("❌ DATABASE_URL environment variable is required", "red");
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
    log(
      "✓ Migration tracking table ready (drizzle.__drizzle_migrations)\n",
      "green",
    );

    const journalPath = join(
      process.cwd(),
      DRIZZLE_FOLDER,
      "meta",
      "_journal.json",
    );
    const journalContent = await readFile(journalPath, "utf-8");
    const journal = JSON.parse(journalContent);

    const migrations = journal.entries ?? [];
    log(`Found ${migrations.length} migrations in journal\n`, "cyan");

    const appliedResult = await pool.query(
      `SELECT hash FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    );
    const appliedHashes = new Set(
      appliedResult.rows.map((row) => row.hash),
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

    log("\n✅ Complete!", "green");
    log(`   Marked: ${marked} migrations`, "green");
    log(`   Skipped: ${skipped} migrations (already applied)\n`, "green");

    const verifyResult = await pool.query(
      `SELECT COUNT(*) as count FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    );
    const count = verifyResult.rows[0]?.count ?? "0";
    log(`📊 Total migrations in tracking table: ${count}\n`, "cyan");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\n❌ Error: ${message}`, "red");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`Fatal error: ${message}`, "red");
  console.error(err);
  process.exit(1);
});
