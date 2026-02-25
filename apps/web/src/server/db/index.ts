// File: apps/web/src/server/db/index.ts

import { env } from "@/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the application. It is only optional for drizzle-kit which can fall back to legacy DB_* variables."
  );
}

function getSslConfig() {
  const isLocalDb = env.DATABASE_URL!.includes("localhost") ||
                    env.DATABASE_URL!.includes("127.0.0.1");

  if (isLocalDb) {
    console.log("[DB] Local database detected. SSL disabled.");
    return undefined;
  }

  console.log("[DB] Cloud database detected. Using standard SSL.");
  return {
    rejectUnauthorized: true,
  };
}

const sslConfig = getSslConfig();

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ...(sslConfig && { ssl: sslConfig }),

  max: isVercel ? 2 : 10,
  min: 0,
  idleTimeoutMillis: isVercel ? 10000 : 60000,
  connectionTimeoutMillis: 10000,

  statement_timeout: 30000,

  ...(isVercel && {
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  }),
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);

});

if (process.env.NODE_ENV === "development") {
  pool.on("connect", () => {
    console.log("[DB] New client connected to pool");
  });

  pool.on("remove", () => {
    console.log("[DB] Client removed from pool");
  });
}

// Track if pool has been ended to prevent "Called end on pool more than once" error
let poolEnded = false;

const gracefulShutdown = () => {
  if (!poolEnded) {
    poolEnded = true;
    console.log("[DB] Closing database pool...");
    void pool.end();
  }
};

if (typeof process !== "undefined") {
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  process.on("beforeExit", gracefulShutdown);
}

export const db = drizzle(pool, { schema });
export { pool };

if (process.env.NODE_ENV === "development") {
  pool
    .query("SELECT NOW()")
    .then(() => {
      console.log("[DB] ✓ Database connection successful");
    })
    .catch((error) => {
      console.error("[DB] ✗ Database connection FAILED:");
      console.error(error);
      console.error("[DB] Please check your DATABASE_URL in .env.local");
    });
}
