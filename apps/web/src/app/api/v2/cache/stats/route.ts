// File: apps/web/src/app/api/v2/cache/stats/route.ts

import { proxySongbirdGet } from "@/app/api/songbird/_lib";
import { auth } from "@/server/auth";
import { proxyApiV2 } from "../../_lib";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.admin) {
    return NextResponse.json(
      { ok: false, error: "Admin access required" },
      { status: 403 },
    );
  }

  if (!request.headers.get("authorization")) {
    return proxySongbirdGet("/cache/stats");
  }

  return proxyApiV2({
    pathname: "/cache/stats",
    request,
    requireAdmin: true,
  });
}
