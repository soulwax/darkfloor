#!/usr/bin/env tsx
// File: scripts/migrate-to-neon.ts

import dotenv from "dotenv";
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadEnvFiles() {
  const envFiles = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

loadEnvFiles();

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message: string) {
  console.error(`${colors.red}${message}${colors.reset}`);
}

function success(message: string) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function info(message: string) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

function warn(message: string) {
  console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function resolveEnvValue(keys: readonly string[]): {
  key: string | null;
  value: string | null;
} {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value.length === 0) continue;
    return { key, value };
  }
  return { key: null, value: null };
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

function detectDatabaseProvider(connectionString: string): string {
  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    if (hostname.includes("prisma.io")) {
      return "Prisma Postgres";
    }
    if (hostname.includes("neon.tech") || hostname.includes("neon.")) {
      return "Neon";
    }
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return "Local Postgres";
    }
    return hostname;
  } catch {
    return "PostgreSQL";
  }
}

type ExistingDataMode = "append" | "skip-table" | "error" | "truncate";
type TableAction =
  | "copy"
  | "truncate-copy"
  | "truncate-only"
  | "skip-empty"
  | "skip-existing";

type TablePlan = {
  table: string;
  sourceCount: number;
  targetCount: number;
  action: TableAction;
};

type MigrationCliOptions = {
  dryRun: boolean;
  existingDataMode: ExistingDataMode;
  onlyTables: Set<string> | null;
  skipTables: Set<string>;
  skipConfirm: boolean;
  verify: boolean;
  batchSize: number;
};

const DEFAULT_BATCH_SIZE = 1000;
const DRIZZLE_CONFIG_PATH = "apps/web/drizzle.config.cjs";

function parseCsvSet(raw: string, flagName: string): Set<string> {
  const values = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (values.length === 0) {
    throw new Error(`Flag ${flagName} requires at least one table name`);
  }
  return new Set(values);
}

function parsePositiveInt(raw: string, flagName: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Flag ${flagName} must be a positive integer`);
  }
  return value;
}

function parseExistingDataMode(raw: string): ExistingDataMode {
  if (
    raw === "append" ||
    raw === "skip-table" ||
    raw === "error" ||
    raw === "truncate"
  ) {
    return raw;
  }
  throw new Error(
    `Invalid existing-data mode "${raw}". Expected one of: append, skip-table, error, truncate`,
  );
}

function printHelp(): void {
  console.log(`
Usage:
  pnpm migrate:neon -- [options]

Options:
  --dry-run                  Build migration plan and counts, but do not write data
  --existing=<mode>          Existing data behavior: append | skip-table | error | truncate
  --skip-existing            Alias for --existing=skip-table
  --truncate-existing        Alias for --existing=truncate
  --only-tables=a,b,c        Migrate only specific tables (exact names)
  --skip-tables=a,b,c        Exclude specific tables
  --batch-size=<n>           Insert batch size (default: ${DEFAULT_BATCH_SIZE})
  --skip-confirm             Skip confirmation prompt
  --no-verify                Skip post-migration row-count verification
  -h, --help                 Show this help

Examples:
  pnpm migrate:neon -- --dry-run
  pnpm migrate:neon -- --existing=skip-table --skip-confirm
  pnpm migrate:neon -- --only-tables=hexmusic-stream_user,hexmusic-stream_session --existing=truncate --skip-confirm

Notes:
  - Source envs: OLD_DATABASE_URL*, OLD_DATABASE_UNPOOLED,
    SOURCE_DATABASE_URL*
  - Target envs: NEW_DATABASE_URL*, NEW_DATABASE_UNPOOLED,
    TARGET_DATABASE_URL*
  - This command is intended for explicit old -> new managed Postgres copies,
    such as Prisma Postgres -> Neon.
`);
}

function parseCliOptions(argv: readonly string[]): MigrationCliOptions {
  const options: MigrationCliOptions = {
    dryRun: false,
    existingDataMode: "append",
    onlyTables: null,
    skipTables: new Set<string>(),
    skipConfirm: process.env.SKIP_CONFIRM === "true",
    verify: true,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--skip-existing") {
      options.existingDataMode = "skip-table";
      continue;
    }
    if (arg === "--truncate-existing") {
      options.existingDataMode = "truncate";
      continue;
    }
    if (arg === "--skip-confirm") {
      options.skipConfirm = true;
      continue;
    }
    if (arg === "--no-verify") {
      options.verify = false;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith("--existing=")) {
      options.existingDataMode = parseExistingDataMode(
        arg.slice("--existing=".length).trim(),
      );
      continue;
    }
    if (arg.startsWith("--only-tables=")) {
      options.onlyTables = parseCsvSet(
        arg.slice("--only-tables=".length),
        "--only-tables",
      );
      continue;
    }
    if (arg.startsWith("--skip-tables=")) {
      options.skipTables = parseCsvSet(
        arg.slice("--skip-tables=".length),
        "--skip-tables",
      );
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      options.batchSize = parsePositiveInt(
        arg.slice("--batch-size=".length),
        "--batch-size",
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function selectTableAction(
  table: string,
  sourceCount: number,
  targetCount: number,
  existingDataMode: ExistingDataMode,
): TableAction {
  if (existingDataMode === "error" && targetCount > 0) {
    throw new Error(
      `Target table "${table}" already has ${targetCount.toLocaleString()} rows (--existing=error)`,
    );
  }

  if (existingDataMode === "skip-table" && targetCount > 0) {
    return "skip-existing";
  }

  if (existingDataMode === "truncate") {
    if (targetCount > 0 && sourceCount > 0) return "truncate-copy";
    if (targetCount > 0 && sourceCount === 0) return "truncate-only";
  }

  if (sourceCount === 0) return "skip-empty";
  return "copy";
}

function describeAction(action: TableAction): string {
  switch (action) {
    case "copy":
      return "copy";
    case "truncate-copy":
      return "truncate+copy";
    case "truncate-only":
      return "truncate-only";
    case "skip-empty":
      return "skip-empty";
    case "skip-existing":
      return "skip-existing";
    default:
      return action;
  }
}

function getSslConfig(connectionString: string) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(connectionString);
  } catch {
    parsed = null;
  }

  const forceInsecure =
    process.env.DB_SSL_INSECURE === "true" ||
    process.env.MIGRATION_SSL_INSECURE === "true";
  const rejectUnauthorizedEnv = process.env.DB_SSL_REJECT_UNAUTHORIZED;
  const caOverride = process.env.DB_SSL_CA;

  const hostname = parsed?.hostname.toLowerCase() ?? "";
  const hasExplicitSslMode =
    parsed?.searchParams.has("sslmode") ??
    connectionString.includes("sslmode=");

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return undefined;
  }

  if (forceInsecure) {
    return { rejectUnauthorized: false };
  }

  if (caOverride) {
    return {
      rejectUnauthorized: rejectUnauthorizedEnv !== "false",
      ca: caOverride,
    };
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

  const possibleCertPaths = [
    path.join(process.cwd(), "certs/ca.pem"),
    path.join(__dirname, "../certs/ca.pem"),
  ];

  for (const certPath of possibleCertPaths) {
    if (existsSync(certPath)) {
      return {
        rejectUnauthorized: process.env.NODE_ENV === "production",
        ca: readFileSync(certPath).toString(),
      };
    }
  }

  if (process.env.DB_SSL_CA) {
    return {
      rejectUnauthorized: rejectUnauthorizedEnv !== "false",
      ca: process.env.DB_SSL_CA,
    };
  }

  console.warn(
    "[Migration] ⚠️  WARNING: Cloud database detected without explicit sslmode and no CA certificate found!",
  );
  console.warn(
    "[Migration] ⚠️  Using rejectUnauthorized: false - vulnerable to MITM attacks",
  );
  console.warn(
    "[Migration] ⚠️  Set DB_SSL_CA environment variable or place your CA certificate at: certs/ca.pem",
  );
  return {
    rejectUnauthorized: false,
  };
}

function isPrismaHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname
      .toLowerCase()
      .includes("prisma.io");
  } catch {
    return connectionString.toLowerCase().includes("prisma.io");
  }
}

function isPrismaPlanLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("planlimitreached") ||
    (message.includes("failed to identify your database") &&
      message.includes("restrictions"))
  );
}

function printPrismaPlanLimitHelp(
  sourceKey: string,
  sourceUrl: string,
  targetKey: string,
): void {
  if (!isPrismaHost(sourceUrl)) {
    return;
  }

  error("");
  error(
    `Source database access is being blocked by the Prisma-hosted source (${sourceKey}).`,
  );
  error(
    "This is not a Supabase target issue, and the migration script cannot produce an exact copy until the source becomes readable again.",
  );
  error("");
  error("Next paths:");
  error(
    "1. Restore or obtain a readable source database URL, then rerun with OLD_DATABASE_URL or SOURCE_DATABASE_URL set explicitly.",
  );
  error(
    "2. If you have a recent SQL dump, restore it into a temporary local/Postgres instance and rerun the migration from that temp source.",
  );
  error(
    `3. If the Prisma source is the only copy, resolve the account restriction with Prisma support before rerunning toward ${targetKey}.`,
  );
  error("");
}

function getPnpmCommand(): string {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function runDrizzlePush(databaseUrl: string): void {
  log(
    `Ensuring target schema exists via Drizzle push (${DRIZZLE_CONFIG_PATH})...`,
    "cyan",
  );

  const result = spawnSync(
    getPnpmCommand(),
    ["drizzle-kit", "push", "--config", DRIZZLE_CONFIG_PATH],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        DRIZZLE_DATABASE_URL: databaseUrl,
        DATABASE_URL: databaseUrl,
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Drizzle push failed with exit code ${result.status ?? "unknown"}`,
    );
  }

  success("Target schema is ready");
}

async function getTablesInOrder(sourcePool: Pool): Promise<string[]> {
  const result = await sourcePool.query(`
    SELECT 
      schemaname,
      tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const tables = result.rows.map((row: any) => row.tablename);

  const fkResult = await sourcePool.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public';
  `);

  const dependencies = new Map<string, Set<string>>();
  for (const row of fkResult.rows) {
    if (!dependencies.has(row.child_table)) {
      dependencies.set(row.child_table, new Set());
    }
    dependencies.get(row.child_table)!.add(row.parent_table);
  }

  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(table: string) {
    if (visiting.has(table)) {
      if (!visited.has(table)) {
        sorted.push(table);
        visited.add(table);
      }
      return;
    }
    if (visited.has(table)) return;

    visiting.add(table);
    const deps = dependencies.get(table);
    if (deps) {
      for (const dep of deps) {
        if (tables.includes(dep)) {
          visit(dep);
        }
      }
    }
    visiting.delete(table);
    if (!visited.has(table)) {
      sorted.push(table);
      visited.add(table);
    }
  }

  for (const table of tables) {
    visit(table);
  }

  for (const table of tables) {
    if (!visited.has(table)) {
      sorted.push(table);
    }
  }

  return sorted;
}

async function getTableCount(pool: Pool, tableName: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM "${tableName}"`,
  );
  return parseInt(result.rows[0].count, 10);
}

async function copyTable(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string,
  batchSize: number,
): Promise<number> {
  const sourceColumnsResult = await sourcePool.query(
    `
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `,
    [tableName],
  );

  const targetColumnsResult = await targetPool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `,
    [tableName],
  );

  const sourceColumns = sourceColumnsResult.rows.map(
    (row: any) => row.column_name,
  );
  const targetColumns = new Set(
    targetColumnsResult.rows.map((row: any) => row.column_name),
  );

  const columns = sourceColumns.filter((col) => targetColumns.has(col));
  const missingColumns = sourceColumns.filter((col) => !targetColumns.has(col));

  if (missingColumns.length > 0) {
    warn(
      `⚠️  Table "${tableName}": Skipping columns that don't exist in target: ${missingColumns.join(", ")}`,
    );
  }

  if (columns.length === 0) {
    warn(
      `⚠️  Table "${tableName}": No common columns found between source and target. Skipping.`,
    );
    return 0;
  }

  const columnTypes = new Map<string, string>();
  sourceColumnsResult.rows.forEach((row: any) => {
    if (columns.includes(row.column_name)) {
      columnTypes.set(row.column_name, row.data_type);
    }
  });
  const columnList = columns.map((col) => `"${col}"`).join(", ");

  const sequenceResult = await sourcePool.query(
    `
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_default LIKE 'nextval%';
  `,
    [tableName],
  );

  const validSequences = sequenceResult.rows.filter((row: any) =>
    columns.includes(row.column_name),
  );
  const hasSequences = validSequences.length > 0;

  const tableExists = await targetPool.query(
    `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `,
    [tableName],
  );

  if (!tableExists.rows[0]?.exists) {
    throw new Error(
      `Table "${tableName}" does not exist on target database. Please run migrations first.`,
    );
  }

  try {
    await targetPool.query(`
      ALTER TABLE "${tableName}" DISABLE TRIGGER USER;
    `);
  } catch (err: any) {
    if (
      !err.message.includes("permission denied") &&
      !err.message.includes("system trigger")
    ) {
      throw err;
    }
  }

  try {
    const sourceData = await sourcePool.query(
      `SELECT ${columnList} FROM "${tableName}"`,
    );

    if (sourceData.rows.length === 0) {
      return 0;
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const insertQuery = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0;

    for (let i = 0; i < sourceData.rows.length; i += batchSize) {
      const batch = sourceData.rows.slice(i, i + batchSize);

      await targetPool.query("BEGIN");
      try {
        for (const row of batch) {
          const values = columns.map((col) => {
            const value = row[col];
            const dataType = columnTypes.get(col);

            if (dataType === "jsonb" || dataType === "json") {
              if (value === null || value === undefined) {
                return null;
              }
              if (typeof value === "string") {
                try {
                  JSON.parse(value);
                  return value;
                } catch (e) {
                  warn(
                    `⚠️  Skipping row in ${tableName}: Invalid JSON in column "${col}": ${value.substring(0, 100)}`,
                  );
                  throw new Error(`Invalid JSON in ${tableName}.${col}`);
                }
              }
              if (typeof value === "object") {
                try {
                  return JSON.stringify(value);
                } catch (e) {
                  warn(
                    `⚠️  Skipping row in ${tableName}: Could not stringify JSON in column "${col}"`,
                  );
                  throw new Error(
                    `Could not stringify JSON in ${tableName}.${col}`,
                  );
                }
              }
              return value;
            }
            return value;
          });
          try {
            const insertResult = await targetPool.query(insertQuery, values);
            inserted += insertResult.rowCount ?? 0;
          } catch (insertErr: any) {
            if (
              insertErr.code === "22P02" &&
              insertErr.message.includes("json")
            ) {
              warn(
                `⚠️  Skipping row in ${tableName} due to JSON error: ${insertErr.message.substring(0, 100)}`,
              );
              continue;
            }
            throw insertErr;
          }
        }
        await targetPool.query("COMMIT");
      } catch (err) {
        await targetPool.query("ROLLBACK");
        throw err;
      }
    }

    if (hasSequences) {
      for (const seqRow of validSequences) {
        const maxResult = await targetPool.query(
          `SELECT COALESCE(MAX("${seqRow.column_name}"), 0) as max_val FROM "${tableName}"`,
        );
        const maxVal = parseInt(maxResult.rows[0].max_val, 10) || 0;

        const seqMatch = seqRow.column_default.match(/nextval\('([^']+)'/);
        if (seqMatch && seqMatch[1]) {
          const seqName = seqMatch[1].replace(/^public\./, "");
          await targetPool.query(`SELECT setval('${seqName}', $1, true)`, [
            maxVal,
          ]);
        }
      }
    }

    return inserted;
  } finally {
    try {
      await targetPool.query(`ALTER TABLE "${tableName}" ENABLE TRIGGER USER;`);
    } catch (err: any) {
      if (
        !err.message.includes("permission denied") &&
        !err.message.includes("system trigger")
      ) {
        console.warn(
          `Warning: Could not re-enable triggers for ${tableName}: ${err.message}`,
        );
      }
    }
  }
}

async function truncateTargetTable(targetPool: Pool, tableName: string) {
  await targetPool.query(
    `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
  );
}

async function main() {
  let options: MigrationCliOptions;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (err: any) {
    error(`\n❌ ${err.message}\n`);
    printHelp();
    process.exit(1);
  }

  log("\n🚀 Starting database migration to target PostgreSQL\n", "bright");
  info(
    `Mode: ${options.dryRun ? "dry-run" : "execute"} | existing=${options.existingDataMode} | batchSize=${options.batchSize}`,
  );
  if (options.onlyTables) {
    info(`Only tables: ${Array.from(options.onlyTables).join(", ")}`);
  }
  if (options.skipTables.size > 0) {
    info(`Skip tables: ${Array.from(options.skipTables).join(", ")}`);
  }

  const sourceCandidates = [
    "OLD_DATABASE_URL_UNPOOLED",
    "OLD_DATABASE_URL",
    "OLD_DATABASE_UNPOOLED",
    "SOURCE_DATABASE_URL_UNPOOLED",
    "SOURCE_DATABASE_URL",
  ] as const;

  const targetCandidates = [
    "NEW_DATABASE_URL_UNPOOLED",
    "NEW_DATABASE_URL",
    "NEW_DATABASE_UNPOOLED",
    "TARGET_DATABASE_URL_UNPOOLED",
    "TARGET_DATABASE_URL",
  ] as const;

  const source = resolveEnvValue(sourceCandidates);
  const target = resolveEnvValue(targetCandidates);
  const sourceUrl = source.value;
  const targetUrl = target.value;
  const targetSchemaPush = resolveEnvValue([
    "NEW_DATABASE_URL",
    "TARGET_DATABASE_URL",
    "NEW_DATABASE_URL_UNPOOLED",
    "NEW_DATABASE_UNPOOLED",
    "TARGET_DATABASE_URL_UNPOOLED",
  ] as const);
  const targetSchemaPushUrl = targetSchemaPush.value ?? targetUrl;

  if (!sourceUrl) {
    error(
      `❌ One source DB URL env var is required: ${sourceCandidates.join(", ")}`,
    );
    error(
      "   Recommended: set OLD_DATABASE_URL / OLD_DATABASE_URL_UNPOOLED to the Prisma-hosted source database",
    );
    process.exit(1);
  }

  if (!targetUrl) {
    error(
      `❌ One target DB URL env var is required: ${targetCandidates.join(", ")}`,
    );
    error(
      "   Recommended: set NEW_DATABASE_URL / NEW_DATABASE_URL_UNPOOLED to the Neon target database",
    );
    process.exit(1);
  }

  if (!source.key || !source.value || !target.key || !target.value)
    throw new Error("Missing source/target URLs");
  info(
    `Source (${source.key}, ${detectDatabaseProvider(source.value)}): ${maskConnectionString(source.value)}`,
  );
  info(
    `Target (${target.key}, ${detectDatabaseProvider(target.value)}): ${maskConnectionString(target.value)}`,
  );
  info(`Target schema push: ${targetSchemaPush.key ?? target.key}`);
  log("", "reset");

  if (sourceUrl === targetUrl) {
    throw new Error(
      `Source and target resolve to the same database URL (${source.key} -> ${target.key}). Set OLD_DATABASE_URL/NEW_DATABASE_URL in the root env, or pass distinct env values before running the migration.`,
    );
  }

  const sourceSsl = getSslConfig(sourceUrl);
  const targetSsl = getSslConfig(targetUrl);

  const sourcePool = new Pool({
    connectionString: sourceUrl,
    ssl: sourceSsl,
    max: 5,
  });

  const targetPool = new Pool({
    connectionString: targetUrl,
    ssl: targetSsl,
    max: 5,
  });

  try {
    log("Testing database connections...", "cyan");
    await sourcePool.query("SELECT 1");
    success("Source database connection successful");

    await targetPool.query("SELECT 1");
    success("Target database connection successful\n");

    if (targetSchemaPushUrl) {
      runDrizzlePush(targetSchemaPushUrl);
      log("", "reset");
    }

    log("Discovering tables...", "cyan");
    const discoveredTables = await getTablesInOrder(sourcePool);
    const discoveredTableSet = new Set(discoveredTables);

    if (options.onlyTables) {
      const unknownOnlyTables = Array.from(options.onlyTables).filter(
        (table) => !discoveredTableSet.has(table),
      );
      if (unknownOnlyTables.length > 0) {
        throw new Error(
          `Unknown table(s) passed via --only-tables: ${unknownOnlyTables.join(", ")}`,
        );
      }
    }

    const unknownSkipTables = Array.from(options.skipTables).filter(
      (table) => !discoveredTableSet.has(table),
    );
    if (unknownSkipTables.length > 0) {
      warn(
        `Ignoring unknown table(s) from --skip-tables: ${unknownSkipTables.join(", ")}`,
      );
    }

    let tables = discoveredTables;
    if (options.onlyTables) {
      tables = tables.filter((table) => options.onlyTables?.has(table));
    }
    if (options.skipTables.size > 0) {
      tables = tables.filter((table) => !options.skipTables.has(table));
    }

    if (tables.length === 0) {
      warn("No tables selected after filters. Nothing to do.");
      return;
    }

    success(`Selected ${tables.length} table(s): ${tables.join(", ")}\n`);

    log("Checking if schema exists on target database...", "cyan");
    const targetTablesResult = await targetPool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public';
    `);
    const targetTableSet = new Set(
      targetTablesResult.rows.map((row: any) => row.tablename as string),
    );
    const missingTargetTables = tables.filter(
      (table) => !targetTableSet.has(table),
    );

    if (missingTargetTables.length > 0) {
      error("\n❌ Required table(s) missing on target database!");
      error(`   Missing: ${missingTargetTables.join(", ")}`);
      error("\n   Create the schema first (recommended in this repo):\n");
      log(
        `   DATABASE_URL="${targetUrl}" pnpm drizzle-kit push --config apps/web/drizzle.config.cjs\n`,
        "bright",
      );
      error("   Or if you prefer migrations:\n");
      log(
        `   DATABASE_URL="${targetUrl}" pnpm drizzle-kit migrate --config apps/web/drizzle.config.cjs\n`,
        "bright",
      );
      process.exit(1);
    }

    success(
      `Schema exists on target database for selected tables (${tables.length} tables)\n`,
    );

    log("Building migration plan (source/target row counts)...", "cyan");
    const tablePlans: TablePlan[] = [];
    const actionCounts = new Map<TableAction, number>();
    let totalSourceRows = 0;
    let totalTargetRows = 0;
    let plannedSourceRows = 0;

    for (const table of tables) {
      const sourceCount = await getTableCount(sourcePool, table);
      const targetCount = await getTableCount(targetPool, table);
      const action = selectTableAction(
        table,
        sourceCount,
        targetCount,
        options.existingDataMode,
      );

      tablePlans.push({ table, sourceCount, targetCount, action });
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
      totalSourceRows += sourceCount;
      totalTargetRows += targetCount;
      if (action === "copy" || action === "truncate-copy") {
        plannedSourceRows += sourceCount;
      }

      if (sourceCount > 0 || targetCount > 0) {
        info(
          `${table}: source ${sourceCount.toLocaleString()} / target ${targetCount.toLocaleString()} -> ${describeAction(action)}`,
        );
      }
    }

    log("\nPlan summary:", "bright");
    const actionOrder: TableAction[] = [
      "copy",
      "truncate-copy",
      "truncate-only",
      "skip-existing",
      "skip-empty",
    ];
    for (const action of actionOrder) {
      const count = actionCounts.get(action) ?? 0;
      if (count > 0) {
        info(`${describeAction(action)}: ${count} table(s)`);
      }
    }
    log(
      `\nRows in selected source tables: ${totalSourceRows.toLocaleString()}`,
      "bright",
    );
    log(
      `Rows in selected target tables: ${totalTargetRows.toLocaleString()}`,
      "bright",
    );
    log(
      `Rows considered for insert: ${plannedSourceRows.toLocaleString()}\n`,
      "bright",
    );

    if (options.dryRun) {
      log("🧪 Dry run complete. No data was modified.\n", "green");
      return;
    }

    if (!options.skipConfirm) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question("⚠️  Execute this migration plan? (yes/no): ", resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
        log("Migration cancelled.", "yellow");
        process.exit(0);
      }
    }

    log("\n🔄 Starting data migration...\n", "bright");
    const startTime = Date.now();
    let totalMigrated = 0;
    const insertedByTable = new Map<string, number>();

    for (let i = 0; i < tablePlans.length; i++) {
      const plan = tablePlans[i];
      if (!plan) continue;
      const prefix = `[${i + 1}/${tablePlans.length}] ${plan.table}`;

      if (plan.action === "skip-empty") {
        log(`${prefix}: skipping (source empty)`, "yellow");
        insertedByTable.set(plan.table, 0);
        continue;
      }

      if (plan.action === "skip-existing") {
        log(
          `${prefix}: skipping (target already has ${plan.targetCount.toLocaleString()} rows)`,
          "yellow",
        );
        insertedByTable.set(plan.table, 0);
        continue;
      }

      if (plan.action === "truncate-only") {
        log(
          `${prefix}: truncating ${plan.targetCount.toLocaleString()} existing rows (source empty)...`,
          "cyan",
        );
        await truncateTargetTable(targetPool, plan.table);
        insertedByTable.set(plan.table, 0);
        success(`${plan.table}: truncated`);
        continue;
      }

      if (plan.action === "truncate-copy") {
        log(
          `${prefix}: truncating ${plan.targetCount.toLocaleString()} existing rows...`,
          "cyan",
        );
        await truncateTargetTable(targetPool, plan.table);
      }

      log(
        `${prefix}: migrating ${plan.sourceCount.toLocaleString()} rows...`,
        "cyan",
      );

      try {
        const inserted = await copyTable(
          sourcePool,
          targetPool,
          plan.table,
          options.batchSize,
        );
        insertedByTable.set(plan.table, inserted);
        totalMigrated += inserted;
        success(`${plan.table}: inserted ${inserted.toLocaleString()} rows`);
      } catch (err: any) {
        error(`${plan.table}: failed - ${err.message}`);
        throw err;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n✅ Migration completed successfully!`, "green");
    log(`   Total rows inserted: ${totalMigrated.toLocaleString()}`, "green");
    log(`   Duration: ${duration}s\n`, "green");

    if (!options.verify) {
      warn("Verification skipped (--no-verify).");
      return;
    }

    log("Verifying migration...", "cyan");
    let verified = true;
    for (const plan of tablePlans) {
      const targetAfter = await getTableCount(targetPool, plan.table);
      const inserted = insertedByTable.get(plan.table) ?? 0;
      let expected = plan.targetCount;

      switch (plan.action) {
        case "skip-empty":
        case "skip-existing":
          expected = plan.targetCount;
          break;
        case "truncate-only":
          expected = 0;
          break;
        case "truncate-copy":
          expected = plan.sourceCount;
          break;
        case "copy":
          expected =
            plan.targetCount === 0
              ? plan.sourceCount
              : plan.targetCount + inserted;
          break;
      }

      if (targetAfter !== expected) {
        error(
          `${plan.table}: count mismatch (expected: ${expected.toLocaleString()}, actual: ${targetAfter.toLocaleString()})`,
        );
        verified = false;
      } else {
        success(
          `${plan.table}: verified (${targetAfter.toLocaleString()} rows)`,
        );
      }
    }

    if (verified) {
      log("\n✅ All selected tables verified successfully!\n", "green");
    } else {
      warn("\n⚠️  Some tables have count mismatches. Please review.\n");
    }
  } catch (err: any) {
    if (isPrismaPlanLimitError(err)) {
      printPrismaPlanLimitHelp(source.key, sourceUrl, target.key);
    }
    error(`\n❌ Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch((err) => {
  error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
