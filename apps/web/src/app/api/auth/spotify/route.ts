// File: apps/web/src/app/api/auth/spotify/route.ts

import { proxyAuthRequest } from "../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyAuthRequest({
    pathname: "/api/auth/spotify",
    request,
    method: "GET",
  });
}
