// File: apps/web/drizzle.config.cjs
// Drizzle config in CJS so drizzle-kit can load it without ESM "require is not defined" errors.
// Keep in sync with drizzle.config.ts (used for type hints; this file is what drizzle-kit uses).

const path = require("path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "../..");
const schemaPath = path.resolve(__dirname, "src/server/db/schema.ts");
// Use relative path so drizzle-kit does not mangle absolute paths (e.g. .//home/...)
const migrationsOutPath = "drizzle";

dotenv.config({ path: path.resolve(repoRoot, ".env.local"), override: true });
dotenv.config({ path: path.resolve(repoRoot, ".env"), override: false });

function getSslConfig() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  const databaseUrl = rawUrl && rawUrl.length > 0 ? rawUrl : undefined;
  const connectionString = databaseUrl ?? process.env.DB_HOST ?? "";
  const isLocalDb =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocalDb) {
    console.log("[Drizzle] Local database detected. SSL disabled.");
    return undefined;
  }
  console.log("[Drizzle] Cloud database detected. Using standard SSL.");
  return { rejectUnauthorized: true };
}

const rawUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawUrl && rawUrl.length > 0 ? rawUrl : undefined;

if (!databaseUrl && !process.env.DB_HOST) {
  console.warn(
    "[Drizzle] Warning: Neither DATABASE_URL nor DB_HOST is set. Database operations may fail."
  );
}

const config = {
  schema: schemaPath,
  out: migrationsOutPath,
  dialect: "postgresql",
  ...(databaseUrl
    ? { dbCredentials: { url: databaseUrl } }
    : {
        dbCredentials: {
          host: process.env.DB_HOST ?? "localhost",
          port: parseInt(process.env.DB_PORT ?? "5432", 10),
          user: process.env.DB_ADMIN_USER,
          password: process.env.DB_ADMIN_PASSWORD,
          database: process.env.DB_NAME ?? "postgres",
          ssl: getSslConfig(),
        },
      }),
};

module.exports = config;
