// File: apps/web/drizzle.config.ts

import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const schemaPath = resolve(__dirname, "src/server/db/schema.ts");
const migrationsOutPath = resolve(__dirname, "drizzle");

dotenvConfig({ path: resolve(repoRoot, ".env.local"), override: true });
dotenvConfig({ path: resolve(repoRoot, ".env"), override: false });

import drizzleEnv from "./drizzle.env";

function getSslConfig() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  const databaseUrl = rawUrl && rawUrl.length > 0 ? rawUrl : undefined;

  const connectionString = databaseUrl ?? drizzleEnv.DB_HOST ?? "";

  const isLocalDb =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  if (isLocalDb) {
    console.log("[Drizzle] Local database detected. SSL disabled.");
    return undefined;
  }

  console.log("[Drizzle] Cloud database detected. Using standard SSL.");
  return {
    rejectUnauthorized: true,
  };
}

const rawUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawUrl && rawUrl.length > 0 ? rawUrl : undefined;

if (!databaseUrl && !process.env.DB_HOST) {
  console.warn(
    "[Drizzle] Warning: Neither DATABASE_URL nor DB_HOST is set. Database operations may fail.",
  );
}

const config = {
  schema: schemaPath,
  out: migrationsOutPath,
  dialect: "postgresql" as const,
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {
        dbCredentials: {
          host: drizzleEnv.DB_HOST ?? "localhost",
          port: parseInt(drizzleEnv.DB_PORT ?? "5432", 10),
          user: drizzleEnv.DB_ADMIN_USER,
          password: drizzleEnv.DB_ADMIN_PASSWORD,
          database: drizzleEnv.DB_NAME ?? "postgres",
          ssl: getSslConfig(),
        },
      }),
};

export default config;
