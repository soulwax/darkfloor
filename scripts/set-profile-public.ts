// File: scripts/set-profile-public.ts

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

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

async function setProfilePublic() {
  try {
    console.log("Connecting to database...");

        const result = await pool.query(`
      UPDATE "hexmusic-stream_user"
      SET "profilePublic" = true
      WHERE email = 'dabox.mailer@gmail.com'
      RETURNING id, name, email, "userHash", "profilePublic"
    `);

    if (result.rowCount === 0) {
      console.log("❌ User not found");
    } else {
      const user = result.rows[0];
      console.log("\n✅ Successfully updated user profile:");
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   userHash: ${user.userHash}`);
      console.log(`   profilePublic: ${user.profilePublic}`);
      console.log(`\n🎉 Your profile is now accessible at: /${user.userHash}`);
    }

    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

setProfilePublic();
