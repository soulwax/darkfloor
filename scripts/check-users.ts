// File: scripts/check-users.ts

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
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

    const certPath = path.join(process.cwd(), "certs/ca.pem");

  if (existsSync(certPath)) {
    console.log(`[DB] Using SSL certificate: ${certPath}`);
    return {
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ca: readFileSync(certPath).toString(),
    };
  }

    if (process.env.DB_SSL_CA) {
    console.log("[DB] Using SSL certificate from DB_SSL_CA environment variable");
    return {
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ca: process.env.DB_SSL_CA,
    };
  }

    console.warn("[DB] ⚠️  WARNING: Cloud database detected but no CA certificate found!");
  console.warn("[DB] ⚠️  Using rejectUnauthorized: false - vulnerable to MITM attacks");
  console.warn("[DB] ⚠️  Set DB_SSL_CA environment variable or place your CA certificate at: certs/ca.pem");
  return {
    rejectUnauthorized: false,
  };
}

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  console.error("❌ Error: a frontend database URL environment variable is required");
  process.exit(1);
}

const sslConfig = getSslConfig(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ...(sslConfig && { ssl: sslConfig }),
});

async function checkUsers() {
  try {
    console.log("Connecting to database...");

        const result = await pool.query(`
      SELECT id, name, email, "userHash", "profilePublic"
      FROM "hexmusic-stream_user"
      ORDER BY "emailVerified" DESC NULLS LAST
      LIMIT 10
    `);

    console.log(`\nFound ${result.rowCount} user(s) in the database:\n`);
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (${row.email})`);
      console.log(`   ID: ${row.id}`);
      console.log(`   userHash: ${row.userHash ?? "NULL"}`);
      console.log(`   profilePublic: ${row.profilePublic}`);
      console.log("");
    });

    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
