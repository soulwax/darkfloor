// File: apps/web/src/app/api/music/releases/latest/route.ts

import { type NextRequest } from "next/server";

import { parseInteger, proxyApiV2Json } from "../../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limit = parseInteger(req.nextUrl.searchParams.get("limit"), {
    defaultValue: 25,
    min: 1,
    max: 100,
  });

  return proxyApiV2Json("/api/music/releases/latest", {
    limit,
  });
}
