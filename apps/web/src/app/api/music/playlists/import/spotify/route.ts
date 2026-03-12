import { proxyApiV2 } from "@/app/api/v2/_lib";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const spotifyImportRequestSchema = z.object({
  spotifyPlaylistId: z.string().trim().min(1),
  nameOverride: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let payload: z.infer<typeof spotifyImportRequestSchema>;

  try {
    payload = spotifyImportRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid Spotify playlist import payload is required.",
      },
      { status: 400 },
    );
  }

  const upstreamRequest = new Request(request.url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playlistId: payload.spotifyPlaylistId,
      createPlaylist: true,
      playlistName: payload.nameOverride,
      isPublic: payload.isPublic,
    }),
  });

  return proxyApiV2({
    pathname: "/spotify/playlists/import",
    request: upstreamRequest,
    method: "POST",
    timeoutMs: 30000,
  });
}
