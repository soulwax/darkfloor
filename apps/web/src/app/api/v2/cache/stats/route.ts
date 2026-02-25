// File: apps/web/src/app/api/v2/cache/stats/route.ts

import { proxyApiV2 } from "../../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyApiV2({
    pathname: "/cache/stats",
    request,
    requireAdmin: true,
  });
}
