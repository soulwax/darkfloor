// File: apps/web/src/app/album/[id]/page.tsx

import { TrackListSection } from "@/components/TrackListSection";
import { TrackPlayButtons } from "@/components/TrackPlayButtons";
import { getRequestBaseUrl } from "@/utils/getBaseUrl";
import type { Track } from "@starchild/types";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type AlbumData = {
  id: number;
  title: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  artist?: { id: number; name: string };
  nb_tracks?: number;
  release_date?: string;
};

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const albumId = parseInt(id, 10);

  if (isNaN(albumId)) {
    notFound();
  }

  const baseUrl = await getRequestBaseUrl();
  let album: AlbumData | null = null;
  let tracks: Track[] = [];

  try {
    const [albumRes, tracksRes] = await Promise.all([
      fetch(new URL(`/api/album/${albumId}`, baseUrl).toString(), {
        next: { revalidate: 300 },
      }),
      fetch(new URL(`/api/album/${albumId}/tracks`, baseUrl).toString(), {
        next: { revalidate: 300 },
      }),
    ]);

    if (albumRes.ok) {
      album = (await albumRes.json()) as AlbumData;
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
    console.error("Failed to fetch album:", err);
  }

  if (!album) {
    return (
      <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text)]">
            Album Not Found
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            The album you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl =
    album.cover_xl ?? album.cover_big ?? album.cover_medium ?? "/placeholder.png";

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:gap-6">
        <div className="flex-shrink-0">
          <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-xl md:max-w-[300px]">
            <Image
              src={coverUrl}
              alt={album.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 200px, 300px"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-2 text-sm font-medium text-[var(--color-subtext)]">
            Album
          </div>
          <h1 className="mb-2 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            {album.title}
          </h1>
          {album.artist && (
            <Link
              href={`/artist/${album.artist.id}`}
              className="mb-4 text-lg text-[var(--color-subtext)] transition-colors hover:text-[var(--color-text)]"
            >
              {album.artist.name}
            </Link>
          )}
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
            {album.nb_tracks && (
              <span>
                {album.nb_tracks} track{album.nb_tracks !== 1 ? "s" : ""}
              </span>
            )}
            {album.release_date && (
              <>
                <span>•</span>
                <span>{new Date(album.release_date).getFullYear()}</span>
              </>
            )}
          </div>
          <TrackPlayButtons tracks={tracks} />
        </div>
      </div>

      <TrackListSection
        tracks={tracks}
        emptyMessage="No tracks available for this album."
      />
    </div>
  );
}
