// File: apps/web/src/app/api/playlist/[id]/route.ts

import { NextResponse } from "next/server";

import { proxyApiV2Json } from "../../music/_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playlistId = Number.parseInt(id, 10);

  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 });
  }

  return proxyApiV2Json(`/api/music/playlists/${playlistId}`);
}
