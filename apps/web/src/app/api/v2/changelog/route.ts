// File: apps/web/src/app/api/v2/changelog/route.ts

import { type NextRequest } from "next/server";
import { proxyApiV2StatusLike } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyApiV2StatusLike("/changelog", request);
}
