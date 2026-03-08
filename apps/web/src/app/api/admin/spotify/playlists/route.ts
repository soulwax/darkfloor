import { proxyApiV2 } from "@/app/api/v2/_lib";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyApiV2({
    pathname: "/spotify/playlists",
    request,
    requireAdmin: true,
    timeoutMs: 15_000,
  });
}
