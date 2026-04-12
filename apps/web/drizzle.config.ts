// File: apps/web/drizzle.config.ts

import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const schemaPath = "apps/web/src/server/db/schema.ts";
const migrationsOutPath = "apps/web/drizzle";

dotenvConfig({ path: resolve(repoRoot, ".env.local"), override: true, quiet: true });
dotenvConfig({ path: resolve(repoRoot, ".env"), override: false, quiet: true });

import drizzleEnv from "./drizzle.env";

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DRIZZLE_DATABASE_URL,
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

function resolveTablesFilter() {
  const raw = process.env.MIGRATION_DRIZZLE_TABLES_FILTER?.trim();
  if (!raw) {
    return undefined;
  }

  const filters = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (filters.length === 0) {
    return undefined;
  }

  return filters.length === 1 ? filters[0] : filters;
}

function getSslConfig() {
  const databaseUrl = resolveDatabaseUrl();
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

const databaseUrl = resolveDatabaseUrl();
const tablesFilter = resolveTablesFilter();

if (!databaseUrl && !process.env.DB_HOST) {
  console.warn(
    "[Drizzle] Warning: Neither DATABASE_URL nor DB_HOST is set. Database operations may fail.",
  );
}

const config = {
  schema: schemaPath,
  out: migrationsOutPath,
  dialect: "postgresql" as const,
  ...(tablesFilter ? { tablesFilter } : {}),
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
