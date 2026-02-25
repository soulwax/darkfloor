// File: apps/web/src/app/page.tsx

import { env } from "@/env";
import type { SearchResponse, Track } from "@starchild/types";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import HomePageClient from "./HomePageClient";

async function getFirstTrackFromSearch(
  query: string,
  baseUrl: string,
): Promise<Track | null> {
  try {
    const url = new URL("/api/music/search", baseUrl);
    url.searchParams.set("q", query);
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const response = (await res.json()) as SearchResponse;
    return response.data?.[0] ?? null;
  } catch (error) {
    console.error("Failed to fetch track for metadata:", error);
    return null;
  }
}

function buildOgImageUrl(track: Track | null, baseUrl: string, query?: string | null): string {
  if (!track) {
    if (query) {
      const params = new URLSearchParams();
      params.set("q", query);
      return `${baseUrl}/api/og?${params.toString()}`;
    }
    const bluesixApiUrl = env.API_V2_URL;
    if (bluesixApiUrl) {
      const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
      return `${normalizedBluesixUrl}/api/preview/default`;
    }
    // Fallback to static OG image served by this app if env not configured
    return `${baseUrl}/og-image.png`;
  }

  const params = new URLSearchParams();
  params.set("trackId", track.id.toString());

  return `${baseUrl}/api/og?${params.toString()}`;
}

async function getRequestBaseUrl(): Promise<string> {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${protocol}://${host}`;
  }

  return getBaseUrl();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = params?.q;
  const requestBaseUrl = await getRequestBaseUrl();

  const defaultOgImage = buildOgImageUrl(null, requestBaseUrl);
  const defaultMetadata: Metadata = {
    title: "Starchild Music",
    description:
      "Modern music streaming and discovery platform with advanced audio features and visual patterns",
    openGraph: {
      title: "Starchild Music",
      description:
        "Modern music streaming and discovery platform with advanced audio features and visual patterns",
      type: "website",
      url: requestBaseUrl,
      siteName: "Starchild Music",
      images: [
        {
          url: defaultOgImage,
          width: 1200,
          height: 630,
          alt: "Starchild Music - Modern music streaming platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Starchild Music",
      description:
        "Modern music streaming and discovery platform with advanced audio features and visual patterns",
      images: [defaultOgImage],
    },
  };

  if (!query || query.trim().length === 0) {
    return defaultMetadata;
  }

  const firstTrack = await getFirstTrackFromSearch(query, requestBaseUrl);
  const ogImage = buildOgImageUrl(firstTrack, requestBaseUrl, query);

  const trackTitle = firstTrack
    ? `${firstTrack.title} by ${firstTrack.artist.name}`
    : `Search: ${query}`;
  const description = firstTrack
    ? `🎵 ${firstTrack.title} by ${firstTrack.artist.name}${firstTrack.album?.title ? ` • ${firstTrack.album.title}` : ""} • Stream on Starchild Music`
    : `Search results for "${query}" on Starchild Music`;

  return {
    title: trackTitle,
    description,
    openGraph: {
      title: trackTitle,
      description,
      type: "music.song",
      url: (() => {
        const params = new URLSearchParams();
        params.set("q", query);
        return `${requestBaseUrl}/?${params.toString()}`;
      })(),
      siteName: "Starchild Music",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: firstTrack
            ? `${firstTrack.title} by ${firstTrack.artist.name}`
            : "Starchild Music",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: trackTitle,
      description,
      images: [ogImage],
    },
  };
}

function getApiHostname(): string | undefined {
  const url = env.API_V2_URL;
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export default function HomePage({
  _searchParams,
}: {
  _searchParams: Promise<{ q?: string }>;
}) {
  const apiHostname = getApiHostname();
  return (
    <Suspense fallback={null}>
      <HomePageClient apiHostname={apiHostname} />
    </Suspense>
  );
}
