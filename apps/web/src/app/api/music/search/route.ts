// File: apps/web/src/app/api/music/search/route.ts

import { env } from "@/env";
import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { type SearchResponse } from "@starchild/types";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q");
  const offset = searchParams.get("offset");

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 },
    );
  }

  try {
    const bluesixApiKey = env.BLUESIX_API_KEY;

    const parseSearchResponse = (data: unknown): SearchResponse | null => {
      if (
        typeof data === "object" &&
        data !== null &&
        "data" in data &&
        Array.isArray((data as Record<string, unknown>).data) &&
        "total" in data &&
        typeof (data as Record<string, unknown>).total === "number"
      ) {
        const responseData = data as {
          data: unknown[];
          total: number;
          next?: string;
        };

        return {
          data: responseData.data as SearchResponse["data"],
          total: responseData.total,
          ...(responseData.next && { next: responseData.next }),
        };
      }

      return null;
    };

    if (getApiV2BaseUrls("read").length === 0 || !bluesixApiKey) {
      return NextResponse.json(
        { error: "API_V2_URL or BLUESIX_API_KEY not configured" },
        { status: 500 },
      );
    }

    const url = new URL("music/search", "http://api-v2.local");
    url.searchParams.set("key", bluesixApiKey);
    url.searchParams.set(
      "kbps",
      req.nextUrl.searchParams.get("kbps") ?? "320",
    );
    url.searchParams.set("q", query);
    if (offset != null) {
      url.searchParams.set("offset", offset);
    }

    console.log(
      "[Music Search API] Fetching from:",
      url.toString().replace(bluesixApiKey, "***"),
    );

    const { response } = await fetchApiV2WithFailover({
      pathname: `${url.pathname}${url.search}`,
      pool: "read",
      timeoutMs: 30000,
      init: {
        headers: {
          "Content-Type": "application/json",
        },
      },
    });

    if (!response.ok) {
      console.error(
        "[Music Search API] Bluesix returned error:",
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
      "[Music Search API] Invalid response structure from Bluesix:",
      data,
    );
    return NextResponse.json(
      {
        error: "Invalid response from Bluesix API: missing required fields (data: Track[], total: number)",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[Music Search API] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Search failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
