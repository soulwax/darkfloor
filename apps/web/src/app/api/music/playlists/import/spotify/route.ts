import { proxyApiV2 } from "@/app/api/v2/_lib";
import { auth } from "@/server/auth";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const spotifyImportRequestSchema = z.object({
  spotifyPlaylistId: z.string().trim().min(1),
  nameOverride: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
  sourcePlaylist: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).nullable().optional(),
      ownerName: z.string().trim().min(1).nullable().optional(),
      trackCount: z.number().int().nonnegative().nullable().optional(),
      tracks: z.array(
        z.object({
          index: z.number().int().nonnegative(),
          spotifyTrackId: z.string().trim().min(1).nullable().optional(),
          name: z.string().trim().min(1),
          artist: z.string().trim().min(1).nullable().optional(),
          artists: z.array(z.string().trim().min(1)).optional(),
          albumName: z.string().trim().min(1).nullable().optional(),
          durationMs: z.number().int().nonnegative().nullable().optional(),
          externalUrl: z.string().trim().min(1).nullable().optional(),
        }),
      ),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

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

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const sourcePlaylist = payload.sourcePlaylist
    ? {
        id: payload.sourcePlaylist.id,
        name: payload.sourcePlaylist.name,
        description: payload.sourcePlaylist.description ?? null,
        ownerName: payload.sourcePlaylist.ownerName ?? null,
        trackCount: payload.sourcePlaylist.trackCount ?? null,
        tracks: payload.sourcePlaylist.tracks.map((track) => ({
          index: track.index,
          spotifyTrackId: track.spotifyTrackId ?? null,
          name: track.name,
          artist: track.artist ?? null,
          artists: track.artists ?? [],
          albumName: track.albumName ?? null,
          durationMs: track.durationMs ?? null,
          externalUrl: track.externalUrl ?? null,
        })),
      }
    : undefined;

  const upstreamRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "spotify",
      playlistId: payload.spotifyPlaylistId,
      createPlaylist: true,
      playlistName: payload.nameOverride,
      playlistDescription: payload.descriptionOverride,
      isPublic: payload.isPublic,
      ...(sourcePlaylist
        ? {
            playlist: sourcePlaylist,
            sourcePlaylist,
          }
        : {}),
    }),
  });

  return proxyApiV2({
    pathname: "/spotify/playlists/import",
    request: upstreamRequest,
    method: "POST",
    timeoutMs: 30000,
  });
}
