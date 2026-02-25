// File: apps/web/src/__tests__/og-image-darkfloor-links.test.ts

import { GET } from "@/app/api/og/route";
import type { SearchResponse, Track } from "@starchild/types";
import { mkdir, writeFile } from "fs/promises";
import type { NextRequest } from "next/server";
import { join } from "path";
import { beforeAll, describe, expect, it } from "vitest";

const TEST_URLS = [
  "https://www.darkfloor.art/?q=film+burn+yppah",
  "https://www.darkfloor.art/track/16620382",
  "https://www.darkfloor.art/?q=apocalyptica+path",
  "https://www.darkfloor.art/track/1913577097",
];

const API_V2_URL =
  process.env.API_V2_URL ??
  process.env.NEXT_PUBLIC_V2_API_URL ??
  "http://localhost:3222";

async function fetchWithTimeout(
  input: RequestInfo | URL,
  timeoutMs: number,
): Promise<Response> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(input),
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Request timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchTrackById(trackId: number): Promise<Track> {
  const deezerUrl = new URL(`https://api.deezer.com/track/${trackId}`);
  const deezerResponse = await fetchWithTimeout(deezerUrl.toString(), 10000);

  if (!deezerResponse.ok) {
    throw new Error(`Failed to fetch track ${trackId}`);
  }

  return (await deezerResponse.json()) as Track;
}

async function fetchTrackBySearch(query: string): Promise<Track> {
  const url = new URL("music/search", API_V2_URL);
  url.searchParams.set("q", query);

  const response = await fetchWithTimeout(url.toString(), 10000);

  if (response.ok) {
    const payload = (await response.json()) as SearchResponse;
    const first = payload.data?.[0];
    if (first) {
      return first;
    }
  }

  const deezerUrl = new URL("https://api.deezer.com/search");
  deezerUrl.searchParams.set("q", query);
  deezerUrl.searchParams.set("limit", "1");

  const deezerResponse = await fetchWithTimeout(deezerUrl.toString(), 10000);

  if (!deezerResponse.ok) {
    throw new Error(`Failed to search track for query "${query}"`);
  }

  const deezerPayload = (await deezerResponse.json()) as SearchResponse;
  const first = deezerPayload.data?.[0];
  if (!first) {
    throw new Error(`No results for query "${query}"`);
  }

  return first;
}

function getTrackIdFromUrl(url: URL): number | null {
  if (url.pathname.startsWith("/track/")) {
    const rawId = url.pathname.split("/track/")[1];
    if (!rawId) return null;
    const trackId = Number.parseInt(rawId, 10);
    return Number.isFinite(trackId) ? trackId : null;
  }
  return null;
}

function getQueryFromUrl(url: URL): string | null {
  const query = url.searchParams.get("q");
  return query ? query.replace(/\+/g, " ") : null;
}

describe("OG image generation for darkfloor URLs", () => {
  beforeAll(async () => {
    await mkdir(join(process.cwd(), "test-output"), { recursive: true });
  });

  for (const testUrl of TEST_URLS) {
    it(`generates OG image for ${testUrl}`, async () => {
      const url = new URL(testUrl);
      const trackId = getTrackIdFromUrl(url);
      const query = getQueryFromUrl(url);

      const track = trackId
        ? await fetchTrackById(trackId)
        : await fetchTrackBySearch(query ?? "");

      expect(track).toBeTruthy();
      expect(track.title).toBeTruthy();
      expect(track.artist?.name).toBeTruthy();

      const ogUrl = new URL("https://www.darkfloor.art/api/og");
      ogUrl.searchParams.set("title", track.title);
      ogUrl.searchParams.set("artist", track.artist.name);
      if (track.album?.title) {
        ogUrl.searchParams.set("album", track.album.title);
      }
      if (track.album?.cover_medium) {
        ogUrl.searchParams.set("cover", track.album.cover_medium);
      }
      if (track.duration) {
        ogUrl.searchParams.set("duration", track.duration.toString());
      }
      ogUrl.searchParams.set("v", String(track.id));

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response).toBeTruthy();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");

      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);

      const safeName = `${track.title}-${track.artist.name}`
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();

      const outputPath = join(
        process.cwd(),
        "test-output",
        `darkfloor-og-${track.id}-${safeName}.png`,
      );

      await writeFile(outputPath, Buffer.from(arrayBuffer));
    }, 30000);
  }
});
