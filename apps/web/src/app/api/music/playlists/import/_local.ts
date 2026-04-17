import { db } from "@/server/db";
import { playlistTracks, playlists } from "@/server/db/schema";
import { type Track } from "@starchild/types";
import { sql } from "drizzle-orm";
import { z } from "zod";

type PostgresConstraintError = {
  code?: string;
  constraint?: string;
};

export const backendDeezerTrackSchema = z
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

export const backendPlaylistImportResponseSchema = z.object({
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
        spotifyTrackId: z.string().trim().min(1).nullable(), // spotifyTrackId = S_p, S_p > 0 v "null"
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

export type BackendPlaylistImportResponse = z.infer<
  typeof backendPlaylistImportResponseSchema
>;

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

function isUniqueConstraintError(
  error: unknown,
  constraint?: string,
): error is PostgresConstraintError {
  if (!error || typeof error !== "object") return false;

  const candidate = error as PostgresConstraintError;
  if (candidate.code !== "23505") return false;
  if (!constraint) return true;

  return candidate.constraint === constraint;
}

async function syncPlaylistIdSequence(): Promise<void> {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"hexmusic-stream_playlist"', 'id'),
      COALESCE((SELECT MAX("id") FROM "hexmusic-stream_playlist"), 0) + 1,
      false
    )
  `);
}

function toLocalTrack(
  matchedTrack: BackendPlaylistImportResponse["matchedTracks"][number],
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
    title_version: coalesceString(matchedTrack.deezerTrack.title_version),
    link:
      coalesceString(matchedTrack.deezerTrack.link) ??
      `https://www.deezer.com/track/${deezerTrackId}`,
    duration: matchedTrack.deezerTrack.duration ?? 0,
    rank: matchedTrack.deezerTrack.rank ?? 0,
    explicit_lyrics: matchedTrack.deezerTrack.explicit_lyrics ?? false,
    explicit_content_lyrics:
      matchedTrack.deezerTrack.explicit_content_lyrics ??
      (matchedTrack.deezerTrack.explicit_lyrics ? 1 : 0),
    explicit_content_cover: matchedTrack.deezerTrack.explicit_content_cover ?? 0,
    preview: matchedTrack.deezerTrack.preview ?? "",
    md5_image:
      coalesceString(
        matchedTrack.deezerTrack.md5_image,
        matchedTrack.deezerTrack.album?.md5_image,
      ) ?? "",
    artist: {
      id: normalizeNumericId(matchedTrack.deezerTrack.artist?.id ?? 0),
      name:
        coalesceString(matchedTrack.deezerTrack.artist?.name) ??
        "Unknown Artist",
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
      title:
        coalesceString(matchedTrack.deezerTrack.album?.title) ??
        "Unknown Album",
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

export async function createLocalPlaylistFromImport(input: {
  userId: string;
  playlistName: string;
  playlistDescription: string | null;
  isPublic: boolean;
  coverImage: string | null;
  translation: BackendPlaylistImportResponse;
}): Promise<{ id: number; name: string }> {
  const tracks = input.translation.matchedTracks.map((matchedTrack) =>
    toLocalTrack(matchedTrack),
  );

  const insertPlaylist = async () =>
    db.transaction(async (tx) => {
      const [playlist] = await tx
        .insert(playlists)
        .values({
          userId: input.userId,
          name: input.playlistName,
          description: input.playlistDescription,
          isPublic: input.isPublic,
          coverImage: input.coverImage,
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

  try {
    return await insertPlaylist();
  } catch (error) {
    if (!isUniqueConstraintError(error, "hexmusic-stream_playlist_pkey")) {
      throw error;
    }

    await syncPlaylistIdSequence();
    return insertPlaylist();
  }
}
