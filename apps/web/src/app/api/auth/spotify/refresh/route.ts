// File: apps/web/src/app/api/auth/spotify/refresh/route.ts

import { proxyAuthRequest } from "../../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return proxyAuthRequest({
    pathname: "/api/auth/spotify/refresh",
    request,
    method: "POST",
    followRedirects: true,
  });
}
