// File: apps/web/src/app/api/v2/music/tracks/[id]/metadata/route.ts

import { proxyApiV2 } from "../../../../_lib";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trackId = Number.parseInt(id, 10);

  if (!Number.isFinite(trackId) || trackId <= 0) {
    return NextResponse.json({ error: "Invalid track ID" }, { status: 400 });
  }

  return proxyApiV2({
    pathname: `/music/tracks/${trackId}/metadata`,
    request,
  });
}
