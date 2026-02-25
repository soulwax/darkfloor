// File: apps/web/src/app/api/v2/status/route.ts

import { proxyApiV2StatusLike } from "../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyApiV2StatusLike("/status", request);
}
