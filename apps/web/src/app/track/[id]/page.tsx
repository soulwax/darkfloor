// File: apps/web/src/app/track/[id]/page.tsx

import { env } from "@/env";
import { getBaseUrl } from "@/utils/getBaseUrl";
import type { Metadata } from "next";
import { TrackRedirect } from "./TrackRedirect";

interface Track {
  id: number;
  title: string;
  duration: number;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover_small?: string;
    cover_medium?: string;
    cover_big?: string;
    cover_xl?: string;
  };
}

function isTrackPayload(value: unknown): value is Track {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Track>;
  const hasArtist =
    typeof candidate.artist === "object" &&
    candidate.artist !== null &&
    typeof candidate.artist.id === "number" &&
    typeof candidate.artist.name === "string";
  const hasAlbum =
    typeof candidate.album === "object" &&
    candidate.album !== null &&
    typeof candidate.album.id === "number" &&
    typeof candidate.album.title === "string";
  return (
    typeof candidate.id === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.duration === "number" &&
    hasArtist &&
    hasAlbum
  );
}

async function getTrack(id: string): Promise<Track | null> {
  try {
    const bluesixApiUrl = env.API_V2_URL;
    const bluesixApiKey = env.BLUESIX_API_KEY;

    if (bluesixApiUrl && bluesixApiKey) {
      const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
      const url = new URL("music/tracks/batch", normalizedBluesixUrl);
      url.searchParams.set("ids", id);

      const response = await fetch(url.toString(), {
        headers: {
          "X-API-Key": bluesixApiKey,
        },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

      if (response.ok) {
        const payload = (await response.json()) as unknown;
        const tracks = Array.isArray(payload)
          ? payload
          : typeof payload === "object" && payload !== null
            ? Array.isArray((payload as { data?: unknown }).data)
              ? (payload as { data: unknown[] }).data
              : Array.isArray((payload as { tracks?: unknown }).tracks)
                ? (payload as { tracks: unknown[] }).tracks
                : []
            : [];
        const candidate = tracks.find(isTrackPayload);
        if (candidate) {
          return candidate;
        }
      }
    } else {
      if (!bluesixApiUrl) {
        console.error("[Track Page] API_V2_URL not configured");
      }
      if (!bluesixApiKey) {
        console.error("[Track Page] BLUESIX_API_KEY not configured");
      }
    }

    const deezerUrl = new URL(`https://api.deezer.com/track/${id}`);
    const deezerResponse = await fetch(deezerUrl.toString(), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (deezerResponse.ok) {
      const deezerTrack = (await deezerResponse.json()) as unknown;
      if (isTrackPayload(deezerTrack)) {
        return deezerTrack;
      }
    }

    return null;
  } catch (error) {
    console.error("[Track Page] Error fetching track:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const track = await getTrack(id);
  const baseUrl = getBaseUrl();

  if (!track) {
    return {
      title: "Track Not Found - Starchild Music",
      description: "The requested track could not be found.",
    };
  }

  const description = `Listen to "${track.title}" by ${track.artist.name}${track.album.title ? ` from ${track.album.title}` : ""} on Starchild Music`;

  // Use trackId for direct backend redirect (simpler & faster)
  const ogImageUrl = new URL(`${baseUrl}/api/og`);
  ogImageUrl.searchParams.set("trackId", id);

  return {
    title: `${track.title} - ${track.artist.name} | Starchild Music`,
    description,
    openGraph: {
      title: track.title,
      description: `${track.artist.name}${track.album.title ? ` • ${track.album.title}` : ""}`,
      type: "music.song",
      url: `${baseUrl}/track/${id}`,
      siteName: "Starchild Music",
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${track.title} - ${track.artist.name}`,
        },
      ],
      ...(track.artist.name && {
        musicians: [track.artist.name],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${track.title} - ${track.artist.name}`,
      description: track.album.title || "Listen on Starchild Music",
      images: [ogImageUrl.toString()],
    },
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrackRedirect id={id} />;
}
