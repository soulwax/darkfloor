// File: apps/web/src/app/api/music/_lib.ts

import { env } from "@/env";
import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { NextResponse } from "next/server";

type IntegerOptions = {
  defaultValue: number;
  min: number;
  max: number;
};

const REQUEST_TIMEOUT_MS = 30000;

export function parseInteger(
  rawValue: string | null,
  options: IntegerOptions,
): number {
  if (!rawValue) return options.defaultValue;

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return options.defaultValue;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}

export function parseIntegerStrict(
  rawValue: string | null,
  options: IntegerOptions,
): number {
  if (!rawValue) return options.defaultValue;

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return options.defaultValue;
  }

  if (parsed < options.min || parsed > options.max) {
    return options.defaultValue;
  }

  return parsed;
}

export async function proxyApiV2Json(
  upstreamPath: string,
  query?: Record<string, string | number | undefined>,
): Promise<NextResponse> {
  if (getApiV2BaseUrls("read").length === 0) {
    return NextResponse.json(
      { error: "API_V2_URL is not configured" },
      { status: 500 },
    );
  }

  const url = new URL(upstreamPath, "http://api-v2.local");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const { response } = await fetchApiV2WithFailover({
      pathname: `${url.pathname}${url.search}`,
      pool: "read",
      timeoutMs: REQUEST_TIMEOUT_MS,
      init: {
        cache: "no-store",
      },
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const includeDetails = env.NODE_ENV !== "production";
      return NextResponse.json(
        {
          error: `Upstream API error: ${response.status}`,
          details: includeDetails && details ? details : undefined,
        },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach upstream API: ${message}` },
      { status: 502 },
    );
  }
}
