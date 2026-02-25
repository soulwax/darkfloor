// File: packages/api-client/src/rest.ts

import type { SearchResponse, Track } from "@starchild/types";
import type { StreamQuality } from "@starchild/types/settings";

export interface FeedArtist {
  id: number;
  name: string;
  tracklist?: string;
  type?: string;
}

export interface ReleaseAlbumItem {
  id: number;
  title: string;
  cover?: string;
  cover_small?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  tracklist?: string;
  artist?: FeedArtist;
  type?: string;
}

export interface PlaylistOwner {
  id?: number;
  name?: string;
  type?: string;
}

export interface PlaylistFeedItem {
  id: number;
  title: string;
  nb_tracks?: number;
  link?: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  tracklist?: string;
  user?: PlaylistOwner;
  type?: string;
}

export interface GenreListItem {
  id: number;
  name: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  type?: string;
}

interface FeedResponse<T> {
  data: T[];
  total?: number;
  next?: string;
  prev?: string;
}

interface FetchFeedOptions {
  baseUrl?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBrowserOrigin(context: string): string {
  if (typeof window === "undefined") {
    throw new Error(
      `${context} requires a browser environment (window is unavailable).`,
    );
  }
  return window.location.origin;
}

function buildFeedUrl(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
  options?: FetchFeedOptions,
): string {
  const trimmedBaseUrl = options?.baseUrl?.trim();

  const url = (() => {
    if (/^https?:\/\//i.test(endpoint)) {
      return new URL(endpoint);
    }

    if (trimmedBaseUrl) {
      return new URL(endpoint, trimmedBaseUrl);
    }

    if (typeof window !== "undefined") {
      return new URL(endpoint, window.location.origin);
    }

    throw new Error(
      `Cannot resolve relative endpoint "${endpoint}" outside the browser. Provide a baseUrl option when calling this helper in SSR/server/node contexts.`,
    );
  })();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

const STREAM_QUALITY_KBPS: Record<StreamQuality, number> = {
  low: 128,
  normal: 192,
  high: 320,
};

function resolveStreamKbps(quality?: StreamQuality | string): number | null {
  if (!quality) return null;
  if (quality in STREAM_QUALITY_KBPS) {
    return STREAM_QUALITY_KBPS[quality as StreamQuality] ?? null;
  }
  return null;
}

async function fetchFeed<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
  options?: FetchFeedOptions,
): Promise<FeedResponse<T>> {
  const requestUrl = buildFeedUrl(endpoint, params, options);

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(
      `Feed request failed (${response.status}) for ${requestUrl}`,
    );
  }

  const payload = (await response.json()) as unknown;
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return payload as FeedResponse<T>;
  }

  return { data: [] };
}

async function fetchMusicSearch(
  query: string,
  offset: number,
  context: string,
): Promise<SearchResponse> {
  const url = new URL("/api/music/search", getBrowserOrigin(context));
  url.searchParams.set("q", query);
  if (offset > 0) url.searchParams.set("offset", offset.toString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return (await res.json()) as SearchResponse;
}

export async function searchTracks(
  query: string,
  offset = 0,
): Promise<SearchResponse> {
  return fetchMusicSearch(query, offset, "searchTracks");
}

export async function searchTracksByArtist(
  artistName: string,
  offset = 0,
): Promise<SearchResponse> {
  const response = await fetchMusicSearch(
    artistName,
    offset,
    "searchTracksByArtist",
  );

  const filtered = response.data
    .filter(
      (track) => track.artist.name.toLowerCase() === artistName.toLowerCase(),
    )
    .sort((a, b) => b.rank - a.rank);

  const hasMore =
    response.next && (filtered.length > 0 || response.data.length > 0);

  return {
    data: filtered,

    total: response.total,

    next: hasMore ? response.next : undefined,
  };
}

export async function getAlbumTracks(albumId: number): Promise<SearchResponse> {
  const url = `/api/album/${albumId}/tracks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch album tracks (${res.status})`);
  const data = (await res.json()) as { data: unknown[] };

  const tracks = (data.data || [])
    .map((track): Track | null => {
      if (typeof track !== "object" || track === null) {
        console.warn("Invalid track data received from API:", track);
        return null;
      }

      const trackObj = track as Partial<Track> & Record<string, unknown>;

      if (
        typeof trackObj.id !== "number" ||
        typeof trackObj.title !== "string" ||
        !trackObj.artist
      ) {
        console.warn(
          `Track ${trackObj.id ?? "unknown"} is missing required properties:`,
          trackObj,
        );
        return null;
      }

      if (!trackObj.album) {
        console.warn(
          `Track ${trackObj.id} is missing album property - this may cause UI issues`,
        );

        return null;
      }

      return trackObj as Track;
    })
    .filter((track): track is Track => track !== null);

  return {
    data: tracks,
    total: tracks.length,
  };
}

export async function getLatestReleases(
  limit = 25,
): Promise<ReleaseAlbumItem[]> {
  const safeLimit = clamp(limit, 1, 100);
  const payload = await fetchFeed<ReleaseAlbumItem>(
    "/api/music/releases/latest",
    { limit: safeLimit },
  );
  return payload.data;
}

export async function getPopularPlaylists(
  limit = 25,
): Promise<PlaylistFeedItem[]> {
  const safeLimit = clamp(limit, 1, 100);
  const payload = await fetchFeed<PlaylistFeedItem>(
    "/api/music/playlists/popular",
    { limit: safeLimit },
  );
  return payload.data;
}

export async function getPlaylistsByGenreId(
  genreId: number,
  limit = 25,
): Promise<PlaylistFeedItem[]> {
  const safeGenreId = Math.max(0, Math.trunc(genreId));
  if (!safeGenreId) return [];

  const safeLimit = clamp(limit, 1, 100);
  const payload = await fetchFeed<PlaylistFeedItem>(
    "/api/music/playlists/by-genre-id",
    {
      genreId: safeGenreId,
      limit: safeLimit,
    },
  );
  return payload.data;
}

export async function getPlaylistsByGenre(
  genre: string,
  limit = 25,
): Promise<PlaylistFeedItem[]> {
  const trimmed = genre.trim();
  if (!trimmed) return [];

  const safeLimit = clamp(limit, 1, 100);
  const payload = await fetchFeed<PlaylistFeedItem>(
    "/api/music/playlists/by-genre",
    {
      genre: trimmed,
      limit: safeLimit,
    },
  );
  return payload.data;
}

export async function getGenres(limit = 80): Promise<GenreListItem[]> {
  const safeLimit = clamp(limit, 1, 500);
  const payload = await fetchFeed<GenreListItem>("/api/music/genres");
  return payload.data.slice(0, safeLimit);
}

export function getStreamUrl(query: string): string {
  const url = new URL("/api/stream", getBrowserOrigin("getStreamUrl"));
  url.searchParams.set("q", query);
  return url.toString();
}

export function getStreamUrlById(id: string): string {
  const url = new URL("/api/stream", getBrowserOrigin("getStreamUrlById"));
  url.searchParams.set("id", id);
  return url.toString();
}

export async function getTrackById(trackId: number): Promise<Track> {
  const url = `/api/track/${trackId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch track (${res.status})`);
  return (await res.json()) as Track;
}
