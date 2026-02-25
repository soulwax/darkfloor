// File: apps/web/src/app/api/songbird/auth-me/route.ts

import { proxySongbirdGet } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return proxySongbirdGet("/api/auth/me");
}
