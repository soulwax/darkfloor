// File: apps/web/src/app/api/admin/auth/fetch-dump/route.ts

import { auth } from "@/server/auth";
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

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 2000);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.admin) {
    return NextResponse.json(
      { ok: false, error: "Admin access required." },
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
      source: "admin-proxy",
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
