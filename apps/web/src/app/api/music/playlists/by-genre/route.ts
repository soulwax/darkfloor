// File: apps/web/src/app/api/music/playlists/by-genre/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { parseInteger, proxyApiV2Json } from "../../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const genre = req.nextUrl.searchParams.get("genre")?.trim();
  if (!genre) {
    return NextResponse.json(
      { error: "Missing query parameter 'genre'" },
      { status: 400 },
    );
  }

  const limit = parseInteger(req.nextUrl.searchParams.get("limit"), {
    defaultValue: 25,
    min: 1,
    max: 100,
  });

  return proxyApiV2Json("/api/music/playlists/by-genre", {
    genre,
    limit,
  });
}
