export type SpotifyImportErrorMessageKey =
  | "importInvalidPlaylist"
  | "importNoMatches"
  | "importLegacyAuthContract"
  | "settingsIncomplete"
  | "credentialsRejected"
  | "usernameNotFound"
  | "playlistUnavailable"
  | "rateLimited"
  | "importUnavailable"
  | "signInRequired"
  | "importPlaylistNotFound"
  | "importReconnectSpotify"
  | "importUpstreamFailure";

type SpotifyImportErrorMessageParams = {
  message: string | null;
  status?: number;
};

export function getSpotifyImportErrorMessageKey(
  params: SpotifyImportErrorMessageParams,
): SpotifyImportErrorMessageKey | null {
  const normalized = params.message?.toLowerCase() ?? null;

  if (normalized) {
    if (
      normalized.includes("invalid playlist") ||
      normalized.includes("playlist id") ||
      normalized.includes("playlist url") ||
      normalized.includes("200 tracks")
    ) {
      return "importInvalidPlaylist";
    }

    if (
      normalized.includes("no matched tracks") ||
      normalized.includes("no tracks matched") ||
      normalized.includes("could not match")
    ) {
      return "importNoMatches";
    }

    if (
      normalized.includes("missing spotify oauth session cookie") ||
      normalized.includes("missing spotify oauth session") ||
      normalized.includes("no auth token")
    ) {
      return "importLegacyAuthContract";
    }

    if (normalized.includes("settings are incomplete")) {
      return "settingsIncomplete";
    }

    if (normalized.includes("credentials were rejected")) {
      return "credentialsRejected";
    }

    if (normalized.includes("username was not found")) {
      return "usernameNotFound";
    }

    if (normalized.includes("private or unavailable")) {
      return "playlistUnavailable";
    }

    if (normalized.includes("rate limit")) {
      return "rateLimited";
    }
  }

  if (params.status === 405 || params.status === 501) {
    return "importUnavailable";
  }

  if (params.status === 401) {
    return "signInRequired";
  }

  if (params.status === 404) {
    return "importPlaylistNotFound";
  }

  if (params.status === 412) {
    return "importReconnectSpotify";
  }

  if (params.status === 403) {
    return "playlistUnavailable";
  }

  if (params.status === 429) {
    return "rateLimited";
  }

  if (params.status === 502) {
    return "importUpstreamFailure";
  }

  return null;
}
