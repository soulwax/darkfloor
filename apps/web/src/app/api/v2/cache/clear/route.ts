// File: apps/web/src/app/api/v2/cache/clear/route.ts

import { proxyApiV2 } from "../../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return proxyApiV2({
    pathname: "/cache/clear",
    request,
    method: "POST",
    requireAdmin: true,
  });
}
