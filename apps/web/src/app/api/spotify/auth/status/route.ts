import { proxyApiV2 } from "@/app/api/v2/_lib";
import { auth } from "@/server/auth";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json(
      { ok: false, error: "Spotify playlist auth is not connected." },
      { status: 401 },
    );
  }

  const upstreamRequest = new Request(request.url, {
    method: "GET",
    headers: new Headers({
      Accept: "application/json",
      Authorization: authorization,
    }),
  });

  return proxyApiV2({
    pathname: "/spotify/auth/status",
    request: upstreamRequest,
    method: "GET",
    timeoutMs: 15_000,
  });
}
