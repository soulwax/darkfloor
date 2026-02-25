// File: apps/web/src/app/api/v2/health/route.ts

import { env } from "@/env";
import { proxyApiV2StatusLike } from "../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const healthPath = env.SONGBIRD_API_HEALTH_URI?.trim() || "/api/health";
  return proxyApiV2StatusLike(healthPath, request);
}
