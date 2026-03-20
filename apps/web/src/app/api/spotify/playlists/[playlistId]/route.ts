// File: apps/web/src/app/api/spotify/playlists/[playlistId]/route.ts

import { NextResponse, type NextRequest } from "next/server";

import {
  fetchUserSpotifyPublicApiJson,
  UserSpotifyFeatureApiError,
} from "@/lib/server/userSpotifyFeatureApi";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    playlistId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  const { playlistId } = await context.params;
  const normalizedPlaylistId = playlistId.trim();
  if (!normalizedPlaylistId) {
    return NextResponse.json(
      { ok: false, error: "playlistId is required" },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchUserSpotifyPublicApiJson<unknown>({
      userId: session.user.id,
      pathname: `/playlists/${encodeURIComponent(normalizedPlaylistId)}`,
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
          error instanceof Error ? error.message : "Spotify playlist failed",
      },
      { status: 502 },
    );
  }
}
