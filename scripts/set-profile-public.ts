// File: scripts/set-profile-public.ts

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

function getSslConfig(connectionString: string) {
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

if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is required");
  process.exit(1);
}

const sslConfig = getSslConfig(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
