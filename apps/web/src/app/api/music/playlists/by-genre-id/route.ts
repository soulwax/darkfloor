// File: apps/web/src/app/api/music/playlists/by-genre-id/route.ts

import { NextResponse, type NextRequest } from "next/server";

import { parseInteger, proxyApiV2Json } from "../../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const genreIdRaw = req.nextUrl.searchParams.get("genreId");
  const genreId = genreIdRaw ? Number(genreIdRaw) : Number.NaN;

  if (!Number.isInteger(genreId) || genreId <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid query parameter 'genreId'" },
      { status: 400 },
    );
  }

  const limit = parseInteger(req.nextUrl.searchParams.get("limit"), {
    defaultValue: 25,
    min: 1,
    max: 100,
  });

  return proxyApiV2Json("/api/music/playlists/by-genre-id", {
    genreId,
    limit,
  });
}
