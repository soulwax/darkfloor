// File: apps/web/src/hooks/useSongbirdCacheStats.ts

"use client";

import { useSongbirdResource } from "./useSongbirdResource";

export type SongbirdCacheStatsResponse = Record<string, unknown>;

export function useSongbirdCacheStats() {
  return useSongbirdResource<SongbirdCacheStatsResponse>(
    "/api/songbird/cache-stats",
  );
}
