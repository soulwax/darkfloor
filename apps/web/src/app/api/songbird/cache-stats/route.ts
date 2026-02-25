// File: apps/web/src/app/api/songbird/cache-stats/route.ts

import { proxySongbirdGet } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return proxySongbirdGet("/cache/stats");
}
