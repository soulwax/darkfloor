// File: apps/web/src/hooks/useSongbirdAuthMe.ts

"use client";

import { useSongbirdResource } from "./useSongbirdResource";

export type SongbirdAuthMeResponse = Record<string, unknown>;

export function useSongbirdAuthMe() {
  return useSongbirdResource<SongbirdAuthMeResponse>("/api/songbird/auth-me");
}
