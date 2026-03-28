// File: apps/web/src/app/api/music/playlists/import/spotify/route.ts

import { proxyApiV2 } from "@/app/api/v2/_lib";
import { getSongbirdAccessToken } from "@/lib/server/songbird-token";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { playlistTracks, playlists } from "@/server/db/schema";
import { type Track } from "@starchild/types";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;
const SPOTIFY_IMPORT_PROXY_TIMEOUT_MS = 90_000;

const spotifyImportSourceTrackSchema = z.object({
  index: z.number().int().nonnegative(),
  spotifyTrackId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
  artist: z.string().trim().min(1).nullable().optional(),
  artists: z.array(z.string().trim().min(1)).optional(),
  albumName: z.string().trim().min(1).nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  externalUrl: z.string().trim().min(1).nullable().optional(),
});

const spotifyImportSourcePlaylistSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  ownerName: z.string().trim().min(1).nullable().optional(),
  trackCount: z.number().int().nonnegative().nullable().optional(),
  imageUrl: z.string().trim().min(1).nullable().optional(),
  tracks: z.array(spotifyImportSourceTrackSchema),
});

const spotifyImportRequestSchema = z.object({
  spotifyPlaylistId: z.string().trim().min(1),
  nameOverride: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
  sourcePlaylist: spotifyImportSourcePlaylistSchema.optional(),
});

const backendDeezerTrackSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    readable: z.boolean().optional(),
    title: z.string().trim().min(1),
    title_short: z.string().optional().nullable(),
    title_version: z.string().optional().nullable(),
    link: z.string().optional().nullable(),
    duration: z.number().int().nonnegative().optional(),
    rank: z.number().int().optional(),
    explicit_lyrics: z.boolean().optional(),
    explicit_content_lyrics: z.number().int().optional(),
    explicit_content_cover: z.number().int().optional(),
    preview: z.string().optional().nullable(),
    md5_image: z.string().optional().nullable(),
    artist: z
      .object({
        id: z.union([z.number(), z.string()]).optional(),
        name: z.string().optional().nullable(),
        link: z.string().optional().nullable(),
        picture: z.string().optional().nullable(),
        picture_small: z.string().optional().nullable(),
        picture_medium: z.string().optional().nullable(),
        picture_big: z.string().optional().nullable(),
        picture_xl: z.string().optional().nullable(),
        tracklist: z.string().optional().nullable(),
      })
      .passthrough()
      .optional(),
    album: z
      .object({
        id: z.union([z.number(), z.string()]).optional(),
        title: z.string().optional().nullable(),
        cover: z.string().optional().nullable(),
        cover_small: z.string().optional().nullable(),
        cover_medium: z.string().optional().nullable(),
        cover_big: z.string().optional().nullable(),
        cover_xl: z.string().optional().nullable(),
        md5_image: z.string().optional().nullable(),
        release_date: z.string().optional().nullable(),
        tracklist: z.string().optional().nullable(),
      })
      .passthrough()
      .optional(),
    bpm: z.number().optional(),
    gain: z.number().optional(),
  })
  .passthrough();

const backendSpotifyImportResponseSchema = z.object({
  ok: z.literal(true),
  playlistCreated: z.boolean().optional(),
  playlist: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
    })
    .nullable()
    .optional(),
  matchedTracks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      spotifyTrackId: z.string().trim().min(1).nullable().optional(),
      deezerTrackId: z.string().trim().min(1),
      deezerTrack: backendDeezerTrackSchema,
    }),
  ),
  importReport: z.object({
    sourcePlaylistId: z.string().trim().min(1),
    sourcePlaylistName: z.string().trim().min(1),
    totalTracks: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    unmatchedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    unmatched: z.array(
      z.object({
        index: z.number().int().nonnegative(),
        spotifyTrackId: z.string().trim().min(1).nullable(),
        name: z.string().trim().min(1),
        artist: z.string().trim().min(1).nullable(),
        reason: z.enum(["not_found", "ambiguous", "invalid", "unsupported"]),
        candidates: z
          .array(
            z.object({
              deezerTrackId: z.string().trim().min(1),
              title: z.string().trim().min(1),
              artist: z.string().trim().min(1).nullable(),
              album: z.string().trim().min(1).nullable(),
              durationSeconds: z.number().int().nonnegative().nullable(),
              score: z.number().nullable(),
              link: z.string().trim().min(1).nullable(),
              coverImageUrl: z.string().trim().min(1).nullable(),
            }),
          )
          .optional(),
      }),
    ),
  }),
});

function normalizeNumericId(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Invalid Deezer numeric id: ${String(value)}`);
}

function coalesceString(
  ...values: Array<string | null | undefined>
): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
}

function coalesceCoverImage(
  track: z.infer<typeof backendDeezerTrackSchema>,
): string | null {
  return (
    coalesceString(
      track.album?.cover_xl,
      track.album?.cover_big,
      track.album?.cover_medium,
      track.album?.cover_small,
      track.album?.cover,
    ) ?? null
  );
}

function toLocalTrack(
  matchedTrack: z.infer<
    typeof backendSpotifyImportResponseSchema
  >["matchedTracks"][number],
): Track {
  const deezerTrackId = normalizeNumericId(
    matchedTrack.deezerTrackId ?? matchedTrack.deezerTrack.id,
  );
  const albumCover = coalesceCoverImage(matchedTrack.deezerTrack) ?? "";
  const albumCoverSmall =
    coalesceString(
      matchedTrack.deezerTrack.album?.cover_small,
      matchedTrack.deezerTrack.album?.cover_medium,
      matchedTrack.deezerTrack.album?.cover,
      albumCover,
    ) ?? "";
  const albumCoverMedium =
    coalesceString(
      matchedTrack.deezerTrack.album?.cover_medium,
      matchedTrack.deezerTrack.album?.cover_big,
      matchedTrack.deezerTrack.album?.cover,
      albumCover,
    ) ?? albumCoverSmall;
  const albumCoverBig =
    coalesceString(
      matchedTrack.deezerTrack.album?.cover_big,
      matchedTrack.deezerTrack.album?.cover_xl,
      matchedTrack.deezerTrack.album?.cover,
      albumCover,
    ) ?? albumCoverMedium;
  const albumCoverXl =
    coalesceString(
      matchedTrack.deezerTrack.album?.cover_xl,
      matchedTrack.deezerTrack.album?.cover_big,
      matchedTrack.deezerTrack.album?.cover,
      albumCover,
    ) ?? albumCoverBig;

  return {
    id: deezerTrackId,
    readable: matchedTrack.deezerTrack.readable ?? true,
    title: matchedTrack.deezerTrack.title,
    title_short:
      matchedTrack.deezerTrack.title_short ?? matchedTrack.deezerTrack.title,
    title_version: matchedTrack.deezerTrack.title_version,
    link:
      coalesceString(matchedTrack.deezerTrack.link) ??
      `https://www.deezer.com/track/${deezerTrackId}`,
    duration: matchedTrack.deezerTrack.duration ?? 0,
    rank: matchedTrack.deezerTrack.rank ?? 0,
    explicit_lyrics: matchedTrack.deezerTrack.explicit_lyrics ?? false,
    explicit_content_lyrics:
      matchedTrack.deezerTrack.explicit_content_lyrics ??
      (matchedTrack.deezerTrack.explicit_lyrics ? 1 : 0),
    explicit_content_cover:
      matchedTrack.deezerTrack.explicit_content_cover ?? 0,
    preview: matchedTrack.deezerTrack.preview ?? "",
    md5_image:
      coalesceString(
        matchedTrack.deezerTrack.md5_image,
        matchedTrack.deezerTrack.album?.md5_image,
      ) ?? "",
    artist: {
      id: normalizeNumericId(matchedTrack.deezerTrack.artist?.id ?? 0),
      name: coalesceString(matchedTrack.deezerTrack.artist?.name) ?? "Unknown Artist",
      link: coalesceString(matchedTrack.deezerTrack.artist?.link),
      picture: coalesceString(matchedTrack.deezerTrack.artist?.picture),
      picture_small: coalesceString(
        matchedTrack.deezerTrack.artist?.picture_small,
      ),
      picture_medium: coalesceString(
        matchedTrack.deezerTrack.artist?.picture_medium,
      ),
      picture_big: coalesceString(matchedTrack.deezerTrack.artist?.picture_big),
      picture_xl: coalesceString(matchedTrack.deezerTrack.artist?.picture_xl),
      tracklist: coalesceString(matchedTrack.deezerTrack.artist?.tracklist),
      type: "artist",
    },
    album: {
      id: normalizeNumericId(matchedTrack.deezerTrack.album?.id ?? 0),
      title: coalesceString(matchedTrack.deezerTrack.album?.title) ?? "Unknown Album",
      cover: albumCover,
      cover_small: albumCoverSmall,
      cover_medium: albumCoverMedium,
      cover_big: albumCoverBig,
      cover_xl: albumCoverXl,
      md5_image:
        coalesceString(
          matchedTrack.deezerTrack.album?.md5_image,
          matchedTrack.deezerTrack.md5_image,
        ) ?? "",
      tracklist: coalesceString(matchedTrack.deezerTrack.album?.tracklist) ?? "",
      type: "album",
      release_date: coalesceString(matchedTrack.deezerTrack.album?.release_date),
    },
    type: "track",
    bpm: matchedTrack.deezerTrack.bpm,
    gain: matchedTrack.deezerTrack.gain,
    deezer_id: deezerTrackId,
    spotify_id: matchedTrack.spotifyTrackId ?? undefined,
  };
}

async function createLocalPlaylistFromSpotifyImport(input: {
  userId: string;
  payload: z.infer<typeof spotifyImportRequestSchema>;
  translation: z.infer<typeof backendSpotifyImportResponseSchema>;
}): Promise<{ id: number; name: string }> {
  const { payload, translation, userId } = input;
  const playlistName =
    coalesceString(
      payload.nameOverride,
      payload.sourcePlaylist?.name,
      translation.playlist?.name,
      translation.importReport.sourcePlaylistName,
    ) ?? "Imported Spotify Playlist";
  const playlistDescription =
    coalesceString(
      payload.descriptionOverride,
      payload.sourcePlaylist?.description,
    ) ?? "Imported from Spotify";
  const coverImage =
    payload.sourcePlaylist?.imageUrl?.trim() ??
    translation.matchedTracks[0]?.deezerTrack.album?.cover_medium ??
    translation.matchedTracks[0]?.deezerTrack.album?.cover ??
    null;
  const tracks = translation.matchedTracks.map((matchedTrack) =>
    toLocalTrack(matchedTrack),
  );

  return db.transaction(async (tx) => {
    const [playlist] = await tx
      .insert(playlists)
      .values({
        userId,
        name: playlistName,
        description: playlistDescription,
        isPublic: payload.isPublic ?? false,
        coverImage,
      })
      .returning({
        id: playlists.id,
        name: playlists.name,
      });

    if (!playlist) {
      throw new Error("Failed to create the imported Starchild playlist.");
    }

    if (tracks.length > 0) {
      await tx.insert(playlistTracks).values(
        tracks.map((track, position) => ({
          playlistId: playlist.id,
          trackId: track.id,
          deezerId:
            typeof track.deezer_id === "string"
              ? Number.parseInt(track.deezer_id, 10)
              : track.deezer_id,
          trackData: track,
          position,
        })),
      );
    }

    return playlist;
  });
}

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
  } else {
    const token = await getSongbirdAccessToken();
    headers.set("authorization", `${token.tokenType} ${token.accessToken}`);
  }

  const sourcePlaylist = payload.sourcePlaylist
    ? {
        id: payload.sourcePlaylist.id,
        name: payload.sourcePlaylist.name,
        description: payload.sourcePlaylist.description ?? null,
        ownerName: payload.sourcePlaylist.ownerName ?? null,
        trackCount: payload.sourcePlaylist.trackCount ?? null,
        imageUrl: payload.sourcePlaylist.imageUrl ?? null,
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
      targetUserId: session.user.id,
      targetUserEmail: session.user.email ?? undefined,
      targetUserName: session.user.name ?? undefined,
      targetUserProfileImage: session.user.image ?? undefined,
      createPlaylist: false,
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

  const upstreamResponse = await proxyApiV2({
    pathname: "/spotify/playlists/import",
    request: upstreamRequest,
    method: "POST",
    timeoutMs: SPOTIFY_IMPORT_PROXY_TIMEOUT_MS,
  });

  if (!upstreamResponse.ok) {
    return upstreamResponse;
  }

  let translationPayload: unknown;

  try {
    translationPayload = await upstreamResponse.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Spotify import backend returned invalid JSON.",
      },
      { status: 502 },
    );
  }

  const parsedTranslation =
    backendSpotifyImportResponseSchema.safeParse(translationPayload);
  if (!parsedTranslation.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The Spotify import backend did not return the matched track payload required to create a Starchild playlist.",
      },
      { status: 502 },
    );
  }

  try {
    const playlist = await createLocalPlaylistFromSpotifyImport({
      userId: session.user.id,
      payload,
      translation: parsedTranslation.data,
    });

    return NextResponse.json({
      ok: true,
      playlist: {
        id: String(playlist.id),
        name: playlist.name,
      },
      importReport: parsedTranslation.data.importReport,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create the imported Starchild playlist.",
      },
      { status: 500 },
    );
  }
}
