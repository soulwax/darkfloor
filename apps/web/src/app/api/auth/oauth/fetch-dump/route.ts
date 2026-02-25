// File: apps/web/src/app/api/auth/oauth/fetch-dump/route.ts

import { env } from "@/env";
import {
  clearAuthFetchDump,
  clearAuthLogDump,
  getAuthFetchDump,
  getAuthLogDump,
  isOAuthVerboseDebugEnabled,
} from "@starchild/auth";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readProvidedUniversalKey(request: NextRequest): string | null {
  const directHeader = request.headers.get("x-universal-key");
  if (directHeader && directHeader.trim().length > 0) {
    return directHeader.trim();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token?.trim() ?? null;
}

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 2000);
}

export async function GET(request: NextRequest) {
  const requiredKey = env.UNIVERSAL_KEY?.trim();
  if (!requiredKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "UNIVERSAL_KEY is not configured. Cannot access OAuth fetch dump.",
      },
      { status: 503 },
    );
  }

  const providedKey = readProvidedUniversalKey(request);
  if (!providedKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing required security token. Provide x-universal-key or Authorization: Bearer <UNIVERSAL_KEY>.",
      },
      { status: 401 },
    );
  }

  if (providedKey !== requiredKey) {
    return NextResponse.json(
      { ok: false, error: "Invalid security token." },
      { status: 403 },
    );
  }

  const url = request.nextUrl;
  const fetchLimit = parseLimit(url.searchParams.get("fetchLimit"), 300);
  const logLimit = parseLimit(url.searchParams.get("logLimit"), 300);
  const clearAfterRead = ["1", "true", "yes"].includes(
    (url.searchParams.get("clear") ?? "").toLowerCase(),
  );

  const fetchDump = getAuthFetchDump(fetchLimit);
  const authLogs = getAuthLogDump(logLimit);

  if (clearAfterRead) {
    clearAuthFetchDump();
    clearAuthLogDump();
  }

  return NextResponse.json(
    {
      ok: true,
      oauthVerboseDebugEnabled: isOAuthVerboseDebugEnabled(),
      fetchedAt: new Date().toISOString(),
      fetchDumpCount: fetchDump.length,
      authLogCount: authLogs.length,
      clearAfterRead,
      fetchDump,
      authLogs,
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
