// File: apps/web/src/app/api/music/search/advanced/route.ts

import { env } from "@/env";
import { type SearchResponse } from "@starchild/types";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const parseSearchResponse = (data: unknown): SearchResponse | null => {
  if (Array.isArray(data)) {
    return { data: data as SearchResponse["data"], total: data.length };
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  if ("data" in data && Array.isArray((data as Record<string, unknown>).data)) {
    const record = data as {
      data: unknown[];
      total?: number;
      next?: string;
      prev?: string;
    };

    return {
      data: record.data as SearchResponse["data"],
      total: typeof record.total === "number" ? record.total : record.data.length,
      ...(record.next ? { next: record.next } : {}),
      ...(record.prev ? { prev: record.prev } : {}),
    };
  }

  return null;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 },
    );
  }

  try {
    const bluesixApiUrl = env.API_V2_URL;
    const bluesixApiKey = env.BLUESIX_API_KEY;

    if (!bluesixApiUrl || !bluesixApiKey) {
      return NextResponse.json(
        { error: "API_V2_URL or BLUESIX_API_KEY not configured" },
        { status: 500 },
      );
    }

    const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
    const url = new URL("music/search/advanced", normalizedBluesixUrl);
    url.searchParams.set("key", bluesixApiKey);
    url.searchParams.set("q", query);

    const passthroughParams = [
      "artist",
      "album",
      "durationMin",
      "durationMax",
      "offset",
      "limit",
    ];

    for (const param of passthroughParams) {
      const value = searchParams.get(param);
      if (value !== null && value !== "") {
        url.searchParams.set(param, value);
      }
    }

    console.log(
      "[Music Advanced Search API] Fetching from:",
      url.toString().replace(bluesixApiKey, "***"),
    );

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(
        "[Music Advanced Search API] Bluesix returned error:",
        response.status,
        response.statusText,
      );
      return NextResponse.json(
        { error: `Bluesix API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data: unknown = await response.json();
    const parsed = parseSearchResponse(data);
    if (parsed) {
      return NextResponse.json(parsed);
    }

    console.error(
      "[Music Advanced Search API] Invalid response structure from Bluesix:",
      data,
    );
    return NextResponse.json(
      {
        error:
          "Invalid response from Bluesix API: missing required fields (data: Track[], total: number)",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[Music Advanced Search API] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Search failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
