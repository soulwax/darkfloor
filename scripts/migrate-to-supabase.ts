#!/usr/bin/env tsx
// File: scripts/migrate-to-supabase.ts

import { spawnSync } from "child_process";
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const migrateScriptPath = path.join(repoRoot, "scripts/migrate-to-neon.ts");

function loadEnvFiles() {
  const envFiles = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    dotenv.config({ path: envFile, override: false });
  }
}

function resolveEnvValue(keys: readonly string[]): {
  key: string | null;
  value: string | null;
} {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    return { key, value };
  }

  return { key: null, value: null };
}

function requireEnvValue(
  keys: readonly string[],
  errorMessage: string,
): { key: string; value: string } {
  const resolved = resolveEnvValue(keys);
  if (!resolved.key || !resolved.value) {
    throw new Error(errorMessage);
  }

  return { key: resolved.key, value: resolved.value };
}

function maskConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return connectionString.replace(/:[^:@/]+@/u, ":****@");
  }
}

function buildSupabaseNonPoolingUrl(): { key: string; value: string } | null {
  const host = process.env.POSTGRES_HOST?.trim();
  const database = process.env.POSTGRES_DATABASE?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD?.trim();

  if (!host || !database || !user || !password) {
    return null;
  }

  const parsed = new URL(
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`,
  );
  parsed.searchParams.set("sslmode", "require");

  return {
    key: "POSTGRES_HOST+POSTGRES_DATABASE+POSTGRES_USER+POSTGRES_PASSWORD",
    value: parsed.toString(),
  };
}

function resolveSourceDatabase(): { key: string; value: string } {
  return requireEnvValue(
    [
      "OLD_DATABASE_URL_UNPOOLED",
      "OLD_DATABASE_URL",
      "OLD_DATABASE_UNPOOLED",
      "SOURCE_DATABASE_URL_UNPOOLED",
      "SOURCE_DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "DATABASE_URL",
    ] as const,
    "Missing source database URL. Set DATABASE_URL for the current database, or explicitly set OLD_DATABASE_URL / SOURCE_DATABASE_URL before running this migration.",
  );
}

function resolveSupabaseTargetCopyDatabase(): { key: string; value: string } {
  const explicit = resolveEnvValue([
    "NEW_DATABASE_URL_UNPOOLED",
    "TARGET_DATABASE_URL_UNPOOLED",
    "SUPABASE_DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "NEW_DATABASE_URL",
    "TARGET_DATABASE_URL",
    "SUPABASE_DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "PRISMA_DATABASE_URL",
  ] as const);

  if (explicit.key && explicit.value) {
    return { key: explicit.key, value: explicit.value };
  }

  const constructed = buildSupabaseNonPoolingUrl();
  if (constructed) {
    return constructed;
  }

  throw new Error(
    "Missing Supabase target database URL. Set POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, POSTGRES_URL, or the POSTGRES_HOST/POSTGRES_DATABASE/POSTGRES_USER/POSTGRES_PASSWORD parts.",
  );
}

function resolveSupabaseTargetSchemaDatabase(fallbackUrl: string): {
  key: string;
  value: string;
} {
  const resolved = resolveEnvValue([
    "NEW_DATABASE_URL",
    "TARGET_DATABASE_URL",
    "SUPABASE_DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "PRISMA_DATABASE_URL",
  ] as const);

  if (resolved.key && resolved.value) {
    return { key: resolved.key, value: resolved.value };
  }

  return { key: "POSTGRES_URL_NON_POOLING", value: fallbackUrl };
}

function hasExplicitExistingMode(argv: readonly string[]): boolean {
  return argv.some(
    (arg) =>
      arg === "--skip-existing" ||
      arg === "--truncate-existing" ||
      arg.startsWith("--existing="),
  );
}

function getTsxCommand(): { command: string; commandArgs: string[] } {
  if (process.platform === "win32") {
    return { command: "npx.cmd", commandArgs: ["tsx"] };
  }

  return { command: "npx", commandArgs: ["tsx"] };
}

function isHelpRequest(argv: readonly string[]): boolean {
  return argv.includes("-h") || argv.includes("--help");
}

function main() {
  const passthroughArgs = process.argv.slice(2);
  const { command, commandArgs } = getTsxCommand();

  if (isHelpRequest(passthroughArgs)) {
    const result = spawnSync(
      command,
      [...commandArgs, migrateScriptPath, ...passthroughArgs],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
      },
    );

    if (result.error) {
      throw result.error;
    }

    process.exit(result.status ?? 0);
  }

  loadEnvFiles();
  const source = resolveSourceDatabase();
  const targetCopy = resolveSupabaseTargetCopyDatabase();
  const targetSchema = resolveSupabaseTargetSchemaDatabase(targetCopy.value);

  if (source.value === targetCopy.value) {
    throw new Error(
      `Source and target resolve to the same database URL (${source.key} -> ${targetCopy.key}). Set OLD_DATABASE_URL / SOURCE_DATABASE_URL explicitly before running the Supabase copy.`,
    );
  }

  const forwardedArgs = hasExplicitExistingMode(passthroughArgs)
    ? passthroughArgs
    : ["--existing=truncate", ...passthroughArgs];

  console.log("[migrate:supabase] Source:", maskConnectionString(source.value));
  console.log(
    "[migrate:supabase] Target copy:",
    maskConnectionString(targetCopy.value),
  );
  console.log(
    "[migrate:supabase] Target schema:",
    maskConnectionString(targetSchema.value),
  );

  if (!hasExplicitExistingMode(passthroughArgs)) {
    console.log(
      "[migrate:supabase] Defaulting to --existing=truncate for an exact target mirror.",
    );
  }

  const result = spawnSync(
    command,
    [...commandArgs, migrateScriptPath, ...forwardedArgs],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        OLD_DATABASE_URL: source.value,
        OLD_DATABASE_URL_UNPOOLED: source.value,
        SOURCE_DATABASE_URL: source.value,
        NEW_DATABASE_URL: targetSchema.value,
        NEW_DATABASE_URL_UNPOOLED: targetCopy.value,
        TARGET_DATABASE_URL: targetSchema.value,
        TARGET_DATABASE_URL_UNPOOLED: targetCopy.value,
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();
