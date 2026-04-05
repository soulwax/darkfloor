// File: apps/web/src/app/api/admin/database-config/route.ts

import { auth } from "@/server/auth";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DatabaseTargetKey = "frontend";

type DatabaseSummary = {
  scheme: string | null;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
};

type DatabaseTargetPayload = {
  key: DatabaseTargetKey;
  label: string;
  envFilePath: string;
  databaseUrl: string | null;
  summary: DatabaseSummary;
  runtimeDatabaseUrl: string | null;
  runtimeSummary: DatabaseSummary | null;
  runtimeMatchesFile: boolean | null;
  reloadHint: string;
};

const updateDatabaseConfigSchema = z.object({
  target: z.enum(["frontend"]),
  databaseUrl: z.string().trim().min(1, "databaseUrl is required."),
});

function readOptionalEnvValue(key: string): string | null {
  const rawValue = process.env[key];
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRepoRoot(): string {
  return readOptionalEnvValue("REPO_ROOT") ?? process.cwd();
}

const TARGET_CONFIG: Record<
  DatabaseTargetKey,
  { label: string; relativePath: string; reloadHint: string }
> = {
  frontend: {
    label: "Frontend",
    relativePath: ".env.local",
    reloadHint:
      readOptionalEnvValue("ADMIN_DB_CONFIG_FRONTEND_RELOAD_HINT") ??
      "Restart or reload the frontend service after saving.",
  },
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseDatabaseSummary(databaseUrl: string | null): DatabaseSummary {
  if (!databaseUrl) {
    return {
      scheme: null,
      host: null,
      port: null,
      database: null,
      username: null,
    };
  }

  try {
    const parsed = new URL(databaseUrl);
    return {
      scheme: parsed.protocol.replace(/:$/u, "") || null,
      host: parsed.hostname || null,
      port: parsed.port ? Number(parsed.port) : null,
      database: parsed.pathname.replace(/^\/+/u, "") || null,
      username: parsed.username || null,
    };
  } catch {
    return {
      scheme: null,
      host: null,
      port: null,
      database: null,
      username: null,
    };
  }
}

function normalizeDatabaseUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(
      "DATABASE_URL must use the postgres:// or postgresql:// scheme.",
    );
  }

  return trimmed;
}

function quoteEnvValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

async function readEnvVariable(
  absolutePath: string,
  key: string,
): Promise<string | null> {
  try {
    const fileContents = await readFile(absolutePath, "utf8");
    const lines = fileContents.split(/\r?\n/u);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const normalizedLine = trimmedLine.startsWith("export ")
        ? trimmedLine.slice("export ".length).trimStart()
        : trimmedLine;

      if (!normalizedLine.startsWith(`${key}=`)) continue;

      const rawValue = normalizedLine.slice(key.length + 1).trim();
      if (rawValue.length === 0) return "";

      if (
        (rawValue.startsWith("\"") && rawValue.endsWith("\"")) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        return rawValue
          .slice(1, -1)
          .replaceAll("\\\"", "\"")
          .replaceAll("\\\\", "\\");
      }

      return rawValue;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function upsertEnvVariable(
  absolutePath: string,
  key: string,
  value: string,
): Promise<void> {
  let fileContents = "";

  try {
    fileContents = await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const nextLine = `${key}=${quoteEnvValue(value)}`;
  const lines = fileContents.length > 0 ? fileContents.split(/\r?\n/u) : [];
  const existingIndex = lines.findIndex((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) return false;

    const normalizedLine = trimmedLine.startsWith("export ")
      ? trimmedLine.slice("export ".length).trimStart()
      : trimmedLine;

    return normalizedLine.startsWith(`${key}=`);
  });

  if (existingIndex >= 0) {
    lines[existingIndex] = nextLine;
  } else {
    lines.push(nextLine);
  }

  const nextContents = `${lines.join("\n").replace(/\n*$/u, "")}\n`;
  await writeFile(absolutePath, nextContents, "utf8");
}

async function buildTargetPayload(
  repoRoot: string,
  target: DatabaseTargetKey,
): Promise<DatabaseTargetPayload> {
  const targetConfig = TARGET_CONFIG[target];
  const absolutePath = path.join(repoRoot, targetConfig.relativePath);
  const databaseUrl = await readEnvVariable(absolutePath, "DATABASE_URL");
  const runtimeDatabaseUrl = readOptionalEnvValue("DATABASE_URL");

  return {
    key: target,
    label: targetConfig.label,
    envFilePath: targetConfig.relativePath,
    databaseUrl,
    summary: parseDatabaseSummary(databaseUrl),
    runtimeDatabaseUrl,
    runtimeSummary: runtimeDatabaseUrl
      ? parseDatabaseSummary(runtimeDatabaseUrl)
      : null,
    runtimeMatchesFile: runtimeDatabaseUrl
      ? runtimeDatabaseUrl === databaseUrl
      : null,
    reloadHint: targetConfig.reloadHint,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.admin) {
    return jsonError("Admin access required.", 403);
  }

  const repoRoot = resolveRepoRoot();

  return NextResponse.json(
    {
      ok: true,
      fetchedAt: new Date().toISOString(),
      frontend: await buildTargetPayload(repoRoot, "frontend"),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.admin) {
    return jsonError("Admin access required.", 403);
  }

  let payload: unknown;
  try {
    payload = (await request.json()) as unknown;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parsedPayload = updateDatabaseConfigSchema.safeParse(payload);
  if (!parsedPayload.success) {
    const firstError = parsedPayload.error.issues[0]?.message;
    return jsonError(firstError ?? "Invalid request payload.", 400);
  }

  const { target, databaseUrl: databaseUrlInput } = parsedPayload.data;

  let databaseUrl: string;
  try {
    databaseUrl = normalizeDatabaseUrl(databaseUrlInput) ?? "";
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid DATABASE_URL.",
      400,
    );
  }

  if (!databaseUrl) {
    return jsonError("databaseUrl is required.", 400);
  }

  const repoRoot = resolveRepoRoot();
  const absolutePath = path.join(repoRoot, TARGET_CONFIG[target].relativePath);

  await upsertEnvVariable(absolutePath, "DATABASE_URL", databaseUrl);

  return NextResponse.json(
    {
      ok: true,
      savedAt: new Date().toISOString(),
      target,
      frontend: await buildTargetPayload(repoRoot, "frontend"),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
