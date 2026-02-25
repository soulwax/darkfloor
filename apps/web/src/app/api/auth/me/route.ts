// File: apps/web/src/app/api/auth/me/route.ts

import { proxyAuthRequest } from "../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyAuthRequest({
    pathname: "/api/auth/me",
    request,
    method: "GET",
    followRedirects: true,
  });
}
