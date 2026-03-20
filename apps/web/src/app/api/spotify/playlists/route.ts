// File: apps/web/src/app/api/spotify/playlists/route.ts

import { NextResponse, type NextRequest } from "next/server";

import {
  fetchUserSpotifyPublicPlaylistsJson,
  UserSpotifyFeatureApiError,
} from "@/lib/server/userSpotifyFeatureApi";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampInteger(
  value: string | null,
  options: { fallback: number; min: number; max: number },
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return options.fallback;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  const searchParams = new URLSearchParams();
  const limit = clampInteger(request.nextUrl.searchParams.get("limit"), {
    fallback: 24,
    min: 1,
    max: 50,
  });
  const offset = clampInteger(request.nextUrl.searchParams.get("offset"), {
    fallback: 0,
    min: 0,
    max: 10_000,
  });
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  try {
    const payload = await fetchUserSpotifyPublicPlaylistsJson<unknown>({
      userId: session.user.id,
      searchParams,
    });

    return NextResponse.json({
      ok: true,
      payload,
    });
  } catch (error) {
    if (error instanceof UserSpotifyFeatureApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Spotify playlists failed",
      },
      { status: 502 },
    );
  }
}
