// File: apps/web/src/hooks/useSearchSuggestions.ts

"use client";

import type { SearchSuggestionItem } from "@starchild/types/searchSuggestions";
import { searchTracks } from "@starchild/api-client/rest";
import { useEffect, useMemo, useState } from "react";

interface UseSearchSuggestionsOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
}

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_MS = 220;

const areSuggestionListsEqual = (
  a: SearchSuggestionItem[],
  b: SearchSuggestionItem[],
): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;

    if (left.id !== right.id) return false;
    if (left.type !== right.type) return false;
    if (left.label !== right.label) return false;
    if (left.query !== right.query) return false;
    if ((left.sublabel ?? null) !== (right.sublabel ?? null)) return false;
    if ((left.artwork ?? null) !== (right.artwork ?? null)) return false;
  }

  return true;
};

const dedupeSuggestions = (
  suggestions: SearchSuggestionItem[],
  limit: number,
): SearchSuggestionItem[] => {
  const seen = new Set<string>();
  const output: SearchSuggestionItem[] = [];

  for (const suggestion of suggestions) {
    const key = `${suggestion.type}:${suggestion.query.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(suggestion);
    if (output.length >= limit) break;
  }

  return output;
};

export function useSearchSuggestions(
  query: string,
  recentSearches: string[],
  options: UseSearchSuggestionsOptions = {},
) {
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedQuery = query.trim();

  // React Query may give us a fresh array each render even if contents are unchanged.
  // A digest avoids effect churn and (more importantly) prevents state-update loops.
  const recentSearchesDigest = useMemo(() => JSON.stringify(recentSearches), [
    recentSearches,
  ]);
  const stableRecentSearches = useMemo(
    () => JSON.parse(recentSearchesDigest) as string[],
    [recentSearchesDigest],
  );

  useEffect(() => {
    const updateSuggestions = (next: SearchSuggestionItem[]) => {
      setSuggestions((prev) =>
        areSuggestionListsEqual(prev, next) ? prev : next,
      );
    };

    if (!enabled) {
      updateSuggestions([]);
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    const buildQuerySuggestions = () => {
      if (!normalizedQuery) return [];
      const lowered = normalizedQuery.toLowerCase();

      return stableRecentSearches
        .filter((entry) => entry.toLowerCase().includes(lowered))
        .slice(0, 4)
        .map((entry, index) => ({
          id: `query-${index}-${entry}`,
          type: "query" as const,
          label: entry,
          query: entry,
        }));
    };

    const querySuggestions = buildQuerySuggestions();

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      updateSuggestions(querySuggestions.slice(0, limit));
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading((prev) => (prev ? prev : true));
        try {
          const response = await searchTracks(normalizedQuery, 0);
          if (cancelled) return;

          const tracks = response.data.slice(0, 10);

          const trackSuggestions: SearchSuggestionItem[] = tracks
            .slice(0, 4)
            .map((track) => ({
              id: `track-${track.id}`,
              type: "track",
              label: track.title,
              sublabel: track.artist.name,
              query: `${track.artist.name} ${track.title}`,
              artwork: track.album?.cover_small ?? track.album?.cover_medium,
            }));

          const artistMap = new Map<string, SearchSuggestionItem>();
          for (const track of tracks) {
            const artist = track.artist?.name?.trim();
            if (!artist) continue;
            if (artistMap.has(artist.toLowerCase())) continue;
            artistMap.set(artist.toLowerCase(), {
              id: `artist-${track.artist.id}-${artist}`,
              type: "artist",
              label: artist,
              sublabel: "Artist",
              query: artist,
              artwork:
                track.artist.picture_small ??
                track.artist.picture_medium ??
                track.album?.cover_small,
            });
            if (artistMap.size >= 3) break;
          }

          const albumMap = new Map<string, SearchSuggestionItem>();
          for (const track of tracks) {
            const albumTitle = track.album?.title?.trim();
            if (!albumTitle) continue;
            const key = `${track.album.id}-${albumTitle}`.toLowerCase();
            if (albumMap.has(key)) continue;
            albumMap.set(key, {
              id: `album-${track.album.id}-${albumTitle}`,
              type: "album",
              label: albumTitle,
              sublabel: track.artist.name,
              query: `${track.artist.name} ${albumTitle}`,
              artwork: track.album.cover_small ?? track.album.cover_medium,
            });
            if (albumMap.size >= 3) break;
          }

          const combined = dedupeSuggestions(
            [
              ...querySuggestions,
              ...Array.from(artistMap.values()),
              ...Array.from(albumMap.values()),
              ...trackSuggestions,
            ],
            limit,
          );

          updateSuggestions(combined);
        } catch (error) {
          console.error(
            "[useSearchSuggestions] Failed to load suggestions:",
            error,
          );
          if (!cancelled) {
            updateSuggestions(querySuggestions.slice(0, limit));
          }
        } finally {
          if (!cancelled) {
            setIsLoading((prev) => (prev ? false : prev));
          }
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    debounceMs,
    enabled,
    limit,
    normalizedQuery,
    stableRecentSearches,
  ]);

  return {
    suggestions,
    isLoading,
  };
}
