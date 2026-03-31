// File: apps/web/src/app/api/v2/auth/me/route.ts

import { proxySongbirdGet } from "@/app/api/songbird/_lib";
import { auth } from "@/server/auth";
import { proxyApiV2 } from "../../_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!request.headers.get("authorization")) {
    const session = await auth();
    if (session?.user?.admin) {
      return proxySongbirdGet("/api/auth/me");
    }
  }

  return proxyApiV2({
    pathname: "/auth/me",
    request,
  });
}
