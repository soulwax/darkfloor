const BASIC_SPOTIFY_LOGIN_SCOPES = [
  "user-read-email",
  "user-read-private",
] as const;

export const SPOTIFY_PLAYLIST_READ_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export type SpotifyPlaylistAuthCapabilityState =
  | "missing"
  | "profile_only"
  | "connected"
  | "error";

export type SpotifyPlaylistAuthSummary = {
  connected: boolean | null;
  displayName: string | null;
  email: string | null;
  spotifyUserId: string | null;
  scopeText: string | null;
  scopes: string[];
  hasPlaylistReadScope: boolean;
  isProfileOnly: boolean;
};

export type SpotifyPlaylistAuthCapability = {
  state: SpotifyPlaylistAuthCapabilityState;
  summary: SpotifyPlaylistAuthSummary | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readFirstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readFirstBoolean(
  record: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }

  return null;
}

function hasAnySpotifyScope(
  scopes: string[],
  requiredScopes: readonly string[],
): boolean {
  return requiredScopes.some((scope) => scopes.includes(scope));
}

function hasAllSpotifyScopes(
  scopes: string[],
  requiredScopes: readonly string[],
): boolean {
  return requiredScopes.every((scope) => scopes.includes(scope));
}

export function extractSpotifyScopeText(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  const directScope = readFirstString(root, ["scope", "scopes"]);
  if (directScope) {
    return directScope;
  }

  for (const value of Object.values(root)) {
    const nestedRecord = asRecord(value);
    if (!nestedRecord) continue;

    const nestedScope = readFirstString(nestedRecord, ["scope", "scopes"]);
    if (nestedScope) {
      return nestedScope;
    }
  }

  const scopes = root.scopes;
  if (Array.isArray(scopes)) {
    const values = scopes.filter(
      (scope): scope is string =>
        typeof scope === "string" && scope.trim().length > 0,
    );
    if (values.length > 0) {
      return values.join(" ");
    }
  }

  return null;
}

export function normalizeSpotifyScopes(scopeText: string | null): string[] {
  if (!scopeText) return [];

  return Array.from(
    new Set(
      scopeText
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0),
    ),
  );
}

export function extractSpotifyPlaylistAuthSummary(
  payload: unknown,
): SpotifyPlaylistAuthSummary | null {
  const root = asRecord(payload);
  if (!root) return null;

  const profile =
    asRecord(root.profile) ??
    asRecord(root.spotifyProfile) ??
    asRecord(root.user) ??
    asRecord(root.account) ??
    root;
  const scopeText = extractSpotifyScopeText(payload);
  const scopes = normalizeSpotifyScopes(scopeText);
  const hasPlaylistReadScope = hasAnySpotifyScope(
    scopes,
    SPOTIFY_PLAYLIST_READ_SCOPES,
  );

  return {
    connected:
      readFirstBoolean(root, ["connected", "isConnected", "hasConnection"]) ??
      readFirstBoolean(profile ?? {}, [
        "connected",
        "isConnected",
        "hasConnection",
      ]),
    displayName: readFirstString(profile ?? {}, [
      "display_name",
      "displayName",
      "name",
      "username",
    ]),
    email: readFirstString(profile ?? {}, ["email"]),
    spotifyUserId: readFirstString(profile ?? {}, ["id", "spotifyUserId"]),
    scopeText,
    scopes,
    hasPlaylistReadScope,
    isProfileOnly:
      hasAllSpotifyScopes(scopes, BASIC_SPOTIFY_LOGIN_SCOPES) &&
      !hasPlaylistReadScope,
  };
}

function isMissingSpotifyPlaylistAuthError(
  status: number | null,
  errorMessage: string | null | undefined,
): boolean {
  if (status === 401) {
    return true;
  }

  if (!errorMessage) {
    return false;
  }

  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("no auth token") ||
    normalized.includes("missing auth token") ||
    normalized.includes("missing bearer") ||
    normalized.includes("playlist auth is not connected")
  );
}

export function resolveSpotifyPlaylistAuthCapability(options: {
  payload?: unknown;
  status?: number | null;
  errorMessage?: string | null;
}): SpotifyPlaylistAuthCapability {
  const summary =
    options.payload !== undefined && options.payload !== null
      ? extractSpotifyPlaylistAuthSummary(options.payload)
      : null;

  if (summary?.hasPlaylistReadScope) {
    return {
      state: "connected",
      summary,
    };
  }

  if (summary?.isProfileOnly || (summary && summary.scopes.length > 0)) {
    return {
      state: "profile_only",
      summary,
    };
  }

  if (
    isMissingSpotifyPlaylistAuthError(
      options.status ?? null,
      options.errorMessage,
    )
  ) {
    return {
      state: "missing",
      summary,
    };
  }

  if (options.errorMessage) {
    return {
      state: "error",
      summary,
    };
  }

  return {
    state: "missing",
    summary,
  };
}

export function getSpotifyConnectedAccountLabel(
  summary: SpotifyPlaylistAuthSummary | null,
): string | null {
  if (!summary) return null;

  return summary.displayName ?? summary.email ?? summary.spotifyUserId ?? null;
}
