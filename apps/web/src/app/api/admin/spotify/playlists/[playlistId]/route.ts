// File: apps/web/src/app/api/admin/spotify/playlists/[playlistId]/route.ts

import { proxyApiV2 } from "@/app/api/v2/_lib";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    playlistId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { playlistId } = await context.params;
  const normalizedPlaylistId = playlistId.trim();

  if (!normalizedPlaylistId) {
    return NextResponse.json(
      { ok: false, error: "Spotify playlist ID is required" },
      { status: 400 },
    );
  }

  return proxyApiV2({
    pathname: `/spotify/playlists/${encodeURIComponent(normalizedPlaylistId)}`,
    request,
    requireAdmin: true,
    timeoutMs: 15_000,
  });
}
