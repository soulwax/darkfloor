// File: packages/api-client/src/trpc/music-import.ts

"use client";

import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { z } from "zod";

const spotifyImportUnmatchedReasonSchema = z.enum([
  "not_found",
  "ambiguous",
  "invalid",
  "unsupported",
]);

const spotifyImportCandidateSchema = z.object({
  deezerTrackId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1).nullable(),
  album: z.string().trim().min(1).nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  score: z.number().nullable(),
  link: z.string().trim().min(1).nullable(),
  coverImageUrl: z.string().trim().min(1).nullable(),
});

const spotifyImportSourceTrackSchema = z.object({
  index: z.number().int().nonnegative(),
  spotifyTrackId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
  artist: z.string().trim().min(1).nullable().optional(),
  artists: z.array(z.string().trim().min(1)).optional(),
  albumName: z.string().trim().min(1).nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  externalUrl: z.string().trim().min(1).nullable().optional(),
  manualDeezerTrackId: z.string().trim().min(1).nullable().optional(),
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

const importSpotifyPlaylistInputSchema = z.object({
  spotifyPlaylistId: z.string().trim().min(1),
  nameOverride: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
  sourcePlaylist: spotifyImportSourcePlaylistSchema.optional(),
  createLocalPlaylist: z.boolean().optional(),
});

const importSpotifyPlaylistResponseSchema = z.object({
  ok: z.literal(true),
  playlistCreated: z.boolean().optional(),
  playlist: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
    })
    .nullable()
    .optional(),
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
        reason: spotifyImportUnmatchedReasonSchema,
        candidates: z.array(spotifyImportCandidateSchema).optional(),
      }),
    ),
  }),
});

const deezerTrackSchema = z.object({ id: z.union([z.number(), z.string()]) })
  .passthrough();

const importM3u8PlaylistInputSchema = z.object({
  content: z.string().min(1),
  sourcePlaylistId: z.string().trim().min(1).optional(),
  sourcePlaylistName: z.string().trim().min(1).optional(),
  playlistName: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  createPlaylist: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

const importM3u8PlaylistResponseSchema = importSpotifyPlaylistResponseSchema.extend({
  matchedTracks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      spotifyTrackId: z.null(),
      deezerTrackId: z.string().trim().min(1),
      deezerTrack: deezerTrackSchema,
    }),
  ),
});

export type ImportSpotifyPlaylistInput = z.input<
  typeof importSpotifyPlaylistInputSchema
>;

export type ImportSpotifyPlaylistResponse = z.infer<
  typeof importSpotifyPlaylistResponseSchema
>;

export type ImportSpotifyPlaylistUnmatchedReason = z.infer<
  typeof spotifyImportUnmatchedReasonSchema
>;

export type ImportM3u8PlaylistInput = z.input<
  typeof importM3u8PlaylistInputSchema
>;

export type ImportM3u8PlaylistResponse = z.infer<
  typeof importM3u8PlaylistResponseSchema
>;

export class ImportSpotifyPlaylistError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ImportSpotifyPlaylistError";
    this.status = status;
    this.payload = payload;
  }
}

export class ImportM3u8PlaylistError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ImportM3u8PlaylistError";
    this.status = status;
    this.payload = payload;
  }
}

type ImportSpotifyPlaylistMutationOptions = Omit<
  UseMutationOptions<
    ImportSpotifyPlaylistResponse,
    ImportSpotifyPlaylistError,
    ImportSpotifyPlaylistInput
  >,
  "mutationFn"
> & {
  fetchImpl?: typeof fetch;
};

type ImportM3u8PlaylistMutationOptions = Omit<
  UseMutationOptions<
    ImportM3u8PlaylistResponse,
    ImportM3u8PlaylistError,
    ImportM3u8PlaylistInput
  >,
  "mutationFn"
> & {
  fetchImpl?: typeof fetch;
};

type ImportSpotifyPlaylistRequestOptions = {
  fetchImpl?: typeof fetch;
};

async function parseJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    );
    if (firstMessage) {
      return firstMessage.trim();
    }
  }

  const error = record.error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return error && typeof error === "object" ? extractErrorMessage(error) : null;
}

function normalizeImportSpotifyPlaylistInput(
  input: ImportSpotifyPlaylistInput,
): ImportSpotifyPlaylistInput {
  const parsedInput = importSpotifyPlaylistInputSchema.parse(input);

  return {
    spotifyPlaylistId: parsedInput.spotifyPlaylistId.trim(),
    nameOverride: parsedInput.nameOverride?.trim() ?? undefined,
    descriptionOverride: parsedInput.descriptionOverride?.trim() ?? undefined,
    isPublic: parsedInput.isPublic,
    createLocalPlaylist: parsedInput.createLocalPlaylist,
    sourcePlaylist: parsedInput.sourcePlaylist
      ? {
          id: parsedInput.sourcePlaylist.id.trim(),
          name: parsedInput.sourcePlaylist.name.trim(),
          description:
            parsedInput.sourcePlaylist.description?.trim() ?? undefined,
          ownerName: parsedInput.sourcePlaylist.ownerName?.trim() ?? undefined,
          trackCount: parsedInput.sourcePlaylist.trackCount,
          imageUrl: parsedInput.sourcePlaylist.imageUrl?.trim() ?? undefined,
          tracks: parsedInput.sourcePlaylist.tracks.map((track) => ({
            index: track.index,
            spotifyTrackId: track.spotifyTrackId?.trim() ?? null,
            name: track.name.trim(),
            artist: track.artist?.trim() ?? null,
            artists:
              track.artists?.map((artist) => artist.trim()).filter(Boolean) ??
              undefined,
            albumName: track.albumName?.trim() ?? null,
            durationMs: track.durationMs,
            externalUrl: track.externalUrl?.trim() ?? null,
            manualDeezerTrackId: track.manualDeezerTrackId?.trim() ?? null,
          })),
        }
      : undefined,
  };
}

function normalizeImportM3u8PlaylistInput(
  input: ImportM3u8PlaylistInput,
): ImportM3u8PlaylistInput {
  const parsedInput = importM3u8PlaylistInputSchema.parse(input);

  return {
    content: parsedInput.content,
    sourcePlaylistId: parsedInput.sourcePlaylistId?.trim() ?? undefined,
    sourcePlaylistName: parsedInput.sourcePlaylistName?.trim() ?? undefined,
    playlistName: parsedInput.playlistName?.trim() ?? undefined,
    descriptionOverride: parsedInput.descriptionOverride?.trim() ?? undefined,
    createPlaylist: parsedInput.createPlaylist,
    isPublic: parsedInput.isPublic,
  };
}

export async function importSpotifyPlaylist(
  input: ImportSpotifyPlaylistInput,
  options: ImportSpotifyPlaylistRequestOptions = {},
): Promise<ImportSpotifyPlaylistResponse> {
  const normalizedInput = normalizeImportSpotifyPlaylistInput(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/music/playlists/import/spotify", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedInput),
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new ImportSpotifyPlaylistError(
      response.status,
      extractErrorMessage(payload) ??
        `Spotify playlist import failed (${response.status})`,
      payload,
    );
  }

  const parsedPayload = importSpotifyPlaylistResponseSchema.safeParse(payload);
  if (!parsedPayload.success) {
    throw new ImportSpotifyPlaylistError(
      502,
      "Spotify playlist import returned an invalid response payload.",
      payload,
    );
  }

  return parsedPayload.data;
}

export async function importM3u8Playlist(
  input: ImportM3u8PlaylistInput,
  options: ImportSpotifyPlaylistRequestOptions = {},
): Promise<ImportM3u8PlaylistResponse> {
  const normalizedInput = normalizeImportM3u8PlaylistInput(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/music/playlists/import/m3u8", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedInput),
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new ImportM3u8PlaylistError(
      response.status,
      extractErrorMessage(payload) ??
        `M3U/M3U8 playlist import failed (${response.status})`,
      payload,
    );
  }

  const parsedPayload = importM3u8PlaylistResponseSchema.safeParse(payload);
  if (!parsedPayload.success) {
    throw new ImportM3u8PlaylistError(
      502,
      "M3U/M3U8 playlist import returned an invalid response payload.",
      payload,
    );
  }

  return parsedPayload.data;
}

export function useImportSpotifyPlaylistMutation(
  options?: ImportSpotifyPlaylistMutationOptions,
): UseMutationResult<
  ImportSpotifyPlaylistResponse,
  ImportSpotifyPlaylistError,
  ImportSpotifyPlaylistInput
> {
  const { fetchImpl, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: (input) => importSpotifyPlaylist(input, { fetchImpl }),
    ...mutationOptions,
  });
}

export function useImportM3u8PlaylistMutation(
  options?: ImportM3u8PlaylistMutationOptions,
): UseMutationResult<
  ImportM3u8PlaylistResponse,
  ImportM3u8PlaylistError,
  ImportM3u8PlaylistInput
> {
  const { fetchImpl, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: (input) => importM3u8Playlist(input, { fetchImpl }),
    ...mutationOptions,
  });
}
