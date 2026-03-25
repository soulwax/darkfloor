// File: apps/web/src/app/api/track/[id]/route.ts

import { env } from "@/env";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return null;
}

function normalizeTrackPayload(track: unknown) {
  if (!track || typeof track !== "object") return null;

  const record = track as Record<string, unknown>;
  const rawId = readNumber(record.id) ?? readNumber(record.deezer_id);
  const title = readString(record.title) ?? readString(record.titleShort);
  const artistRecord =
    typeof record.artist === "object" && record.artist !== null
      ? (record.artist as Record<string, unknown>)
      : null;
  const albumRecord =
    typeof record.album === "object" && record.album !== null
      ? (record.album as Record<string, unknown>)
      : null;

  const artistId =
    readNumber(artistRecord?.id) ?? readNumber(record.artistId) ?? 0;
  const artistName =
    readString(artistRecord?.name) ?? readString(record.artistName);
  const albumId = readNumber(albumRecord?.id) ?? readNumber(record.albumId) ?? 0;
  const albumTitle =
    readString(albumRecord?.title) ?? readString(record.albumTitle);

  if (rawId === null || !title || !artistName || !albumTitle) {
    return null;
  }

  const cover =
    readString(albumRecord?.cover) ??
    readString(record.coverUrl) ??
    readString(record.coverMedium) ??
    readString(record.coverBig) ??
    readString(record.coverXl) ??
    "";
  const coverSmall =
    readString(albumRecord?.cover_small) ?? readString(record.coverSmall) ?? cover;
  const coverMedium =
    readString(albumRecord?.cover_medium) ??
    readString(record.coverMedium) ??
    coverSmall;
  const coverBig =
    readString(albumRecord?.cover_big) ?? readString(record.coverBig) ?? coverMedium;
  const coverXl =
    readString(albumRecord?.cover_xl) ?? readString(record.coverXl) ?? coverBig;

  return {
    id: rawId,
    readable: readBoolean(record.readable) ?? true,
    title,
    title_short:
      readString(record.title_short) ??
      readString(record.titleShort) ??
      title,
    ...(readString(record.title_version)
      ? { title_version: readString(record.title_version) }
      : {}),
    link: readString(record.link) ?? "",
    duration: readNumber(record.duration) ?? 0,
    rank: readNumber(record.rank) ?? 0,
    explicit_lyrics:
      readBoolean(record.explicit_lyrics) ??
      readBoolean(record.explicitLyrics) ??
      false,
    explicit_content_lyrics:
      readNumber(record.explicit_content_lyrics) ??
      (readBoolean(record.explicit_lyrics) ??
        readBoolean(record.explicitLyrics) ??
        false
        ? 1
        : 0),
    explicit_content_cover: readNumber(record.explicit_content_cover) ?? 0,
    preview: readString(record.preview) ?? "",
    md5_image:
      readString(record.md5_image) ??
      readString(albumRecord?.md5_image) ??
      "",
    artist: {
      id: artistId,
      name: artistName,
      ...(readString(artistRecord?.link) ? { link: readString(artistRecord?.link) } : {}),
      ...(readString(artistRecord?.picture)
        ? { picture: readString(artistRecord?.picture) }
        : {}),
      ...(readString(artistRecord?.picture_small)
        ? { picture_small: readString(artistRecord?.picture_small) }
        : {}),
      ...(readString(artistRecord?.picture_medium)
        ? { picture_medium: readString(artistRecord?.picture_medium) }
        : {}),
      ...(readString(artistRecord?.picture_big)
        ? { picture_big: readString(artistRecord?.picture_big) }
        : {}),
      ...(readString(artistRecord?.picture_xl)
        ? { picture_xl: readString(artistRecord?.picture_xl) }
        : {}),
      ...(readString(artistRecord?.tracklist)
        ? { tracklist: readString(artistRecord?.tracklist) }
        : {}),
      type: "artist" as const,
    },
    album: {
      id: albumId,
      title: albumTitle,
      cover,
      cover_small: coverSmall,
      cover_medium: coverMedium,
      cover_big: coverBig,
      cover_xl: coverXl,
      md5_image:
        readString(albumRecord?.md5_image) ?? readString(record.md5_image) ?? "",
      tracklist: readString(albumRecord?.tracklist) ?? "",
      type: "album" as const,
      ...(readString(albumRecord?.release_date)
        ? { release_date: readString(albumRecord?.release_date) }
        : {}),
      ...(Array.isArray(albumRecord?.genres)
        ? {
            genres: albumRecord?.genres as Array<{ id: number; name: string }>,
          }
        : {}),
    },
    type: "track" as const,
    deezer_id:
      readNumber(record.deezer_id) ??
      readString(record.deezer_id) ??
      rawId,
    ...(readString(record.spotify_id)
      ? { spotify_id: readString(record.spotify_id) }
      : {}),
    ...(readNumber(record.bpm) !== null ? { bpm: readNumber(record.bpm) } : {}),
    ...(readNumber(record.gain) !== null
      ? { gain: readNumber(record.gain) }
      : {}),
    ...(readString(record.release_date)
      ? { release_date: readString(record.release_date) }
      : {}),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing track ID parameter" },
      { status: 400 },
    );
  }

  const bluesixApiUrl = env.API_V2_URL;
  const bluesixApiKey = env.BLUESIX_API_KEY;

  try {
    if (bluesixApiUrl && bluesixApiKey) {
      try {
        const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
        const bluesixUrl = new URL("music/tracks/batch", normalizedBluesixUrl);
        bluesixUrl.searchParams.set("ids", id);

        console.log("[Track API] Trying Bluesix V2:", bluesixUrl.toString());

        const bluesixResponse = await fetch(bluesixUrl.toString(), {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": bluesixApiKey,
          },
          signal: AbortSignal.timeout(8000),
        });

        if (bluesixResponse.ok) {
          const payload = (await bluesixResponse.json()) as unknown;
          const tracks = Array.isArray(payload)
            ? payload
            : typeof payload === "object" && payload !== null
              ? Array.isArray((payload as { data?: unknown }).data)
                ? (payload as { data: unknown[] }).data
                : Array.isArray((payload as { tracks?: unknown }).tracks)
                  ? (payload as { tracks: unknown[] }).tracks
                  : []
              : [];

          const track =
            tracks.length > 0 ? normalizeTrackPayload(tracks[0]) : null;
          if (track) {
            return NextResponse.json(track);
          }
        } else {
          console.warn(
            "[Track API] Bluesix V2 error:",
            bluesixResponse.status,
            bluesixResponse.statusText,
          );
        }
      } catch (err) {
        console.warn("[Track API] Bluesix V2 request failed:", err);
      }
    }

    const deezerUrl = new URL(`https://api.deezer.com/track/${id}`);
    console.log("[Track API] Falling back to Deezer API:", deezerUrl.toString());
    const deezerResponse = await fetch(deezerUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (deezerResponse.ok) {
      const deezerData = (await deezerResponse.json()) as unknown;
      const normalizedTrack = normalizeTrackPayload(deezerData);
      if (normalizedTrack) {
        return NextResponse.json(normalizedTrack);
      }

      return NextResponse.json(
        {
          error: "Track payload shape was invalid",
          message: "The upstream track response could not be normalized.",
          type: "invalid_payload",
        },
        { status: 502 },
      );
    }

    const errorText = await deezerResponse
      .text()
      .catch(() => "Could not read error response");
    return NextResponse.json(
      {
        error: `Failed to fetch track: ${deezerResponse.statusText}`,
        message: errorText,
        status: deezerResponse.status,
      },
      { status: deezerResponse.status },
    );
  } catch (error) {
    console.error("[Track API] Error fetching track:", error);

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        return NextResponse.json(
          {
            error: "Backend request timed out",
            message: "The backend server did not respond in time.",
            type: "timeout",
          },
          { status: 504 },
        );
      }

      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND")
      ) {
        return NextResponse.json(
          {
            error: "Cannot connect to backend",
            message: "Failed to connect to backend.",
            type: "connection_error",
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch track",
        message: error instanceof Error ? error.message : "Unknown error",
        type: "unknown_error",
      },
      { status: 500 },
    );
  }
}
