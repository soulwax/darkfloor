#!/usr/bin/env tsx
// File: scripts/migrate-to-neon.ts

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

dotenv.config({ path: ".env.local" });
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      rejectUnauthorized: process.env.NODE_ENV === "production",
      ca: process.env.DB_SSL_CA,
    };
  }

  console.warn(
    "[Migration] ⚠️  WARNING: Cloud database detected but no CA certificate found!",
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

    const batchSize = 1000;
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
            await targetPool.query(insertQuery, values);
            inserted++;
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

async function main() {
  log("\n🚀 Starting database migration to NEON Postgres\n", "bright");

  const sourceUrl =
    process.env.OLD_DATABASE_URL ||
    process.env.SOURCE_DATABASE_URL ||
    process.env.DATABASE_URL;

  const targetUrl =
    process.env.DATABASE_UNPOOLED || process.env.TARGET_DATABASE_URL;

  if (!sourceUrl) {
    error(
      "❌ OLD_DATABASE_URL, SOURCE_DATABASE_URL, or DATABASE_URL environment variable is required",
    );
    error("   Recommended: Set OLD_DATABASE_URL for the source database");
    process.exit(1);
  }

  if (!targetUrl) {
    error(
      "❌ DATABASE_UNPOOLED or TARGET_DATABASE_URL environment variable is required",
    );
    error("   Recommended: Set DATABASE_UNPOOLED for the Neon target database");
    process.exit(1);
  }

  info(`Source: ${sourceUrl.replace(/:[^:@]+@/, ":****@")}`);
  info(`Target: ${targetUrl.replace(/:[^:@]+@/, ":****@")}\n`);

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

    log("Discovering tables...", "cyan");
    const tables = await getTablesInOrder(sourcePool);
    success(`Found ${tables.length} tables: ${tables.join(", ")}\n`);

    log("Checking if schema exists on target database...", "cyan");
    const schemaCheck = await targetPool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'hexmusic-stream_%';
    `);

    const tableCount = parseInt(schemaCheck.rows[0]?.count || "0", 10);

    if (tableCount === 0) {
      error("\n❌ Schema not found on target database!");
      error("   The target database appears to be empty.");
      error(
        "\n   Please run the following command first to create the schema:\n",
      );
      log(`   DATABASE_URL="${targetUrl}" npm run db:push\n`, "bright");
      error("   Or if you prefer migrations:\n");
      log(`   DATABASE_URL="${targetUrl}" npm run db:migrate\n`, "bright");
      process.exit(1);
    } else if (tableCount < tables.length) {
      warn(
        `⚠️  Found ${tableCount} tables on target, but source has ${tables.length} tables.`,
      );
      warn("   Some tables may be missing. Continuing anyway...\n");
    } else {
      success(
        `Schema exists on target database (${tableCount} tables found)\n`,
      );
    }

    log("Counting rows in source database...", "cyan");
    const sourceCounts = new Map<string, number>();
    for (const table of tables) {
      const count = await getTableCount(sourcePool, table);
      sourceCounts.set(table, count);
      if (count > 0) {
        info(`${table}: ${count.toLocaleString()} rows`);
      }
    }

    const totalRows = Array.from(sourceCounts.values()).reduce(
      (a, b) => a + b,
      0,
    );
    log(`\nTotal rows to migrate: ${totalRows.toLocaleString()}\n`, "bright");

    if (process.env.SKIP_CONFIRM !== "true") {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          "⚠️  This will copy all data to the target database. Continue? (yes/no): ",
          resolve,
        );
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

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      if (!table) continue;
      const sourceCount = sourceCounts.get(table) ?? 0;

      if (sourceCount === 0) {
        log(`[${i + 1}/${tables.length}] ${table}: skipping (empty)`, "yellow");
        continue;
      }

      log(
        `[${i + 1}/${tables.length}] ${table}: migrating ${sourceCount.toLocaleString()} rows...`,
        "cyan",
      );

      try {
        const migrated = await copyTable(sourcePool, targetPool, table);
        totalMigrated += migrated;
        success(`${table}: migrated ${migrated.toLocaleString()} rows`);
      } catch (err: any) {
        error(`${table}: failed - ${err.message}`);
        throw err;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n✅ Migration completed successfully!`, "green");
    log(`   Total rows migrated: ${totalMigrated.toLocaleString()}`, "green");
    log(`   Duration: ${duration}s\n`, "green");

    log("Verifying migration...", "cyan");
    let verified = true;
    for (const table of tables) {
      const sourceCount = sourceCounts.get(table) ?? 0;
      if (sourceCount === 0) continue;

      const targetCount = await getTableCount(targetPool, table);
      if (sourceCount !== targetCount) {
        error(
          `${table}: count mismatch (source: ${sourceCount}, target: ${targetCount})`,
        );
        verified = false;
      } else {
        success(`${table}: verified (${targetCount.toLocaleString()} rows)`);
      }
    }

    if (verified) {
      log("\n✅ All tables verified successfully!\n", "green");
    } else {
      warn("\n⚠️  Some tables have count mismatches. Please review.\n");
    }
  } catch (err: any) {
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
