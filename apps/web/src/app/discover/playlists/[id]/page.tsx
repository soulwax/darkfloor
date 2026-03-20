// File: apps/web/src/app/discover/playlists/[id]/page.tsx

import { TrackListSection } from "@/components/TrackListSection";
import { TrackPlayButtons } from "@/components/TrackPlayButtons";
import { getRequestBaseUrl } from "@/utils/getBaseUrl";
import type { Track } from "@starchild/types";
import { isTrack } from "@starchild/types";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    deezer_id: track.deezer_id ?? track.id,
  };
}

function parsePlaylistTracks(payload: unknown): Track[] {
  if (Array.isArray(payload)) {
    return payload.filter(isTrack).map(normalizeTrack);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.tracks)
      ? record.tracks
      : [];

  return rows.filter(isTrack).map(normalizeTrack);
}

export default async function DiscoverPlaylistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const playlistId = Number.parseInt(id, 10);

  const t = await getTranslations("discover");
  const tc = await getTranslations("common");

  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return (
      <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text)]">
            {t("playlistNotFound")}
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            {t("invalidPlaylistId")}
          </p>
          <Link href="/" className="btn-primary">
            {tc("goHome")}
          </Link>
        </div>
      </div>
    );
  }

  const baseUrl = await getRequestBaseUrl();
  let tracks: Track[] = [];
  let error: string | null = null;

  try {
    const response = await fetch(
      new URL(`/api/playlist/${playlistId}`, baseUrl).toString(),
      { next: { revalidate: 300 } },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    tracks = parsePlaylistTracks(payload);
  } catch (err) {
    console.error("Failed to fetch discover playlist:", err);
    error = err instanceof Error ? err.message : t("failedToLoadTracks");
  }

  if (error || tracks.length === 0) {
    return (
      <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text)]">
            {t("playlistNotFound")}
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            {error ?? t("noPlayableTracks")}
          </p>
          <Link href="/" className="btn-primary">
            {tc("goHome")}
          </Link>
        </div>
      </div>
    );
  }

  const rawTitle = typeof resolvedSearchParams.title === "string"
    ? resolvedSearchParams.title.trim()
    : "";
  const displayTitle = rawTitle || `${t("label")} #${playlistId}`;

  const coverUrl =
    tracks[0]?.album.cover_xl ??
    tracks[0]?.album.cover_big ??
    tracks[0]?.album.cover_medium ??
    "/placeholder.png";

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:gap-6">
        <div className="flex-shrink-0">
          <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-xl md:max-w-[300px]">
            <Image
              src={coverUrl}
              alt={displayTitle}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 200px, 300px"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-2 text-sm font-medium text-[var(--color-subtext)]">
            {t("label")}
          </div>
          <h1 className="mb-2 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            {displayTitle}
          </h1>
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
            <span>{tc("tracks", { count: tracks.length })}</span>
          </div>
          <TrackPlayButtons tracks={tracks} />
        </div>
      </div>

      <TrackListSection
        tracks={tracks}
        emptyMessage={t("noTracksAvailable")}
      />
    </div>
  );
}
