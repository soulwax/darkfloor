#!/usr/bin/env node
// File: scripts/generate-ssl-cert.js

import dotenv from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const nodeEnv = process.env.NODE_ENV || "development";
const isDev = nodeEnv === "development";

if (isDev) {
  dotenv.config({ path: path.resolve(projectRoot, ".env") });
} else {
  dotenv.config({ path: path.resolve(projectRoot, ".env.local") });
  dotenv.config({ path: path.resolve(projectRoot, ".env.production") });
  dotenv.config({ path: path.resolve(projectRoot, ".env") });
}

async function generateSSLCert() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (databaseUrl.includes("neon.tech")) {
    console.log("ℹ️  Neon database detected - SSL handled automatically, skipping certificate generation");
    return;
  }

  const certContent = process.env.DB_SSL_CA;

  if (!certContent) {
    console.warn("⚠️  DB_SSL_CA environment variable not set");
    console.log("   Skipping SSL certificate generation");
    return;
  }

  console.log("🔐 Generating PostgreSQL SSL certificate...");

  const certsDir = path.resolve(projectRoot, "certs");
  const certPath = path.resolve(certsDir, "ca.pem");

  try {
    await mkdir(certsDir, { recursive: true });

    const cleanCert = certContent.replace(/^["']|["']$/g, "");
    await writeFile(certPath, cleanCert, "utf8");

    console.log(`✅ SSL certificate written to: ${certPath}`);
  } catch (error) {
    console.error("❌ Failed to generate SSL certificate:", error);
    process.exit(1);
  }
}

generateSSLCert();
