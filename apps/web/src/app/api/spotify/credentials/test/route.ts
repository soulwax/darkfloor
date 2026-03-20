// File: apps/web/src/app/api/spotify/credentials/test/route.ts

import { NextResponse } from "next/server";

import { testUserSpotifyFeatureCredentials } from "@/lib/server/userSpotifyFeatureApi";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  const checkedAt = new Date().toISOString();

  try {
    const result = await testUserSpotifyFeatureCredentials(session.user.id);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        message: result.message,
        checkedAt,
        diagnostics: result.diagnostics,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: result.message,
        code: result.code,
        checkedAt,
        diagnostics: result.diagnostics,
      },
      { status: result.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Spotify credential test failed",
        checkedAt,
      },
      { status: 502 },
    );
  }
}
