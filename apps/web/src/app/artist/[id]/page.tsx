// File: apps/web/src/app/artist/[id]/page.tsx

import { TrackListSection } from "@/components/TrackListSection";
import { TrackPlayButtons } from "@/components/TrackPlayButtons";
import { getRequestBaseUrl } from "@/utils/getBaseUrl";
import type { Track } from "@starchild/types";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type ArtistData = {
  id: number;
  name: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
};

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artistId = parseInt(id, 10);

  if (isNaN(artistId)) {
    notFound();
  }

  const baseUrl = await getRequestBaseUrl();
  let artist: ArtistData | null = null;
  let tracks: Track[] = [];

  try {
    const [artistRes, tracksRes] = await Promise.all([
      fetch(new URL(`/api/artist/${artistId}`, baseUrl).toString(), {
        next: { revalidate: 300 },
      }),
      fetch(new URL(`/api/artist/${artistId}/tracks`, baseUrl).toString(), {
        next: { revalidate: 300 },
      }),
    ]);

    if (artistRes.ok) {
      artist = (await artistRes.json()) as ArtistData;
    }

    if (tracksRes.ok) {
      const tracksData = (await tracksRes.json()) as {
        data: unknown[];
        total?: number;
      };
      tracks = (tracksData.data ?? [])
        .map((track): Track | null => {
          if (typeof track !== "object" || track === null) return null;
          const trackObj = track as Partial<Track> & Record<string, unknown>;
          if (
            typeof trackObj.id !== "number" ||
            typeof trackObj.title !== "string" ||
            !trackObj.artist ||
            !trackObj.album
          ) {
            return null;
          }
          return trackObj as Track;
        })
        .filter((track): track is Track => track !== null);
    }
  } catch (err) {
    console.error("Failed to fetch artist:", err);
  }

  if (!artist) {
    return (
      <div className="container mx-auto px-3 py-4 md:py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text)]">
            Artist Not Found
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            The artist you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const pictureUrl =
    artist.picture_xl ?? artist.picture_big ?? artist.picture_medium ?? "/placeholder.png";

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:gap-6">
        <div className="flex-shrink-0">
          <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-full md:max-w-[300px]">
            <Image
              src={pictureUrl}
              alt={artist.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 200px, 300px"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-2 text-sm font-medium text-[var(--color-subtext)]">
            Artist
          </div>
          <h1 className="mb-4 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            {artist.name}
          </h1>
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
            {artist.nb_album !== undefined && (
              <span>
                {artist.nb_album} album{artist.nb_album !== 1 ? "s" : ""}
              </span>
            )}
            {artist.nb_fan !== undefined && (
              <>
                <span>•</span>
                <span>{artist.nb_fan.toLocaleString()} fans</span>
              </>
            )}
          </div>
          <TrackPlayButtons tracks={tracks} />
        </div>
      </div>

      <TrackListSection
        tracks={tracks}
        heading="Popular Tracks"
        emptyMessage="No tracks available for this artist."
      />
    </div>
  );
}
