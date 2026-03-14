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

const importSpotifyPlaylistInputSchema = z.object({
  spotifyPlaylistId: z.string().trim().min(1),
  nameOverride: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  isPublic: z.boolean().optional(),
});

const importSpotifyPlaylistResponseSchema = z.object({
  ok: z.literal(true),
  playlist: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
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
      }),
    ),
  }),
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
