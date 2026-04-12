// File: apps/web/drizzle.config.cjs
// Drizzle config in CJS so drizzle-kit can load it without ESM "require is not defined" errors.
// Keep in sync with drizzle.config.ts (used for type hints; this file is what drizzle-kit uses).

const path = require("path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "../..");
const schemaPath = "apps/web/src/server/db/schema.ts";
const migrationsOutPath = "apps/web/drizzle";

dotenv.config({
  path: path.resolve(repoRoot, ".env.local"),
  override: true,
  quiet: true,
});
dotenv.config({ path: path.resolve(repoRoot, ".env"), override: false, quiet: true });

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

function getSslConfig() {
  const databaseUrl = resolveDatabaseUrl();
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

const databaseUrl = resolveDatabaseUrl();

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
