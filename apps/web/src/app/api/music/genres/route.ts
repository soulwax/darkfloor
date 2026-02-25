// File: apps/web/src/app/api/music/genres/route.ts

import { proxyApiV2Json } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return proxyApiV2Json("/api/music/genres");
}
