// File: apps/web/src/lib/server/userSpotifyFeatureApi.ts

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { userPreferences } from "@/server/db/schema";

const SPOTIFY_ACCOUNTS_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_WEB_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_EXPIRY_SKEW_MS = 60_000;

type SpotifyAppTokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

type SpotifyUserFeatureConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  username: string;
};

export type SpotifyUserFeatureCredentialDiagnostics = {
  enabled: boolean;
  username: string;
  clientIdPreview: string;
  clientSecretLength: number;
};

export type UserSpotifyFeatureCredentialTestResult =
  | {
      ok: true;
      status: 200;
      message: string;
      code: null;
      diagnostics: SpotifyUserFeatureCredentialDiagnostics;
    }
  | {
      ok: false;
      status: number;
      message: string;
      code: string | null;
      diagnostics: SpotifyUserFeatureCredentialDiagnostics;
    };

type FetchUserSpotifyPublicApiJsonOptions = {
  userId: string;
  pathname: string;
  searchParams?: URLSearchParams;
};

type FetchUserSpotifyPublicPlaylistsJsonOptions = {
  userId: string;
  searchParams?: URLSearchParams;
};

const spotifyAppTokenCache = new Map<string, SpotifyAppTokenCacheEntry>();

export class UserSpotifyFeatureApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "UserSpotifyFeatureApiError";
    this.status = status;
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readSpotifyErrorMessage(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;

  const nestedError = asRecord(record.error);
  if (typeof nestedError?.message === "string") {
    return nestedError.message;
  }

  if (typeof record.error_description === "string") {
    return record.error_description;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  return null;
}

function normalizeSpotifyUserFeatureConfig(
  value: Partial<SpotifyUserFeatureConfig> | null | undefined,
): SpotifyUserFeatureConfig {
  return {
    enabled: value?.enabled === true,
    clientId: typeof value?.clientId === "string" ? value.clientId.trim() : "",
    clientSecret:
      typeof value?.clientSecret === "string" ? value.clientSecret.trim() : "",
    username: typeof value?.username === "string" ? value.username.trim() : "",
  };
}

function isSpotifyUserFeatureConfigComplete(
  config: Pick<
    SpotifyUserFeatureConfig,
    "clientId" | "clientSecret" | "username"
  >,
): boolean {
  return Boolean(
    config.clientId.length > 0 &&
    config.clientSecret.length > 0 &&
    config.username.length > 0,
  );
}

function getSpotifyTokenCacheKey(config: SpotifyUserFeatureConfig): string {
  return `${config.clientId}:${config.clientSecret}`;
}

function createSpotifyClientIdPreview(clientId: string): string {
  const trimmed = clientId.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function clearSpotifyTokenCache(config: SpotifyUserFeatureConfig): void {
  spotifyAppTokenCache.delete(getSpotifyTokenCacheKey(config));
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function buildSpotifyApiError(options: {
  pathname: string;
  status: number;
  payload: unknown;
}): UserSpotifyFeatureApiError {
  const { pathname, payload, status } = options;
  const detail = readSpotifyErrorMessage(payload);

  if (status === 404 && pathname.startsWith("/users/")) {
    return new UserSpotifyFeatureApiError(
      "Spotify username was not found. Check the username in Settings.",
      404,
      "spotify_user_not_found",
    );
  }

  if (status === 404 && pathname.startsWith("/playlists/")) {
    return new UserSpotifyFeatureApiError(
      "Spotify playlist was not found.",
      404,
      "spotify_playlist_not_found",
    );
  }

  if (status === 403 && pathname.startsWith("/playlists/")) {
    return new UserSpotifyFeatureApiError(
      "This Spotify playlist is private or unavailable to public playlist access.",
      403,
      "spotify_playlist_unavailable",
    );
  }

  if (status === 429) {
    return new UserSpotifyFeatureApiError(
      "Spotify rate limit reached. Try again shortly.",
      429,
      "spotify_rate_limited",
    );
  }

  return new UserSpotifyFeatureApiError(
    detail ?? "Spotify request failed.",
    status >= 500 ? 502 : status,
    "spotify_request_failed",
  );
}

export async function getUserSpotifyFeatureConfig(
  userId: string,
): Promise<SpotifyUserFeatureConfig> {
  const preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
    columns: {
      spotifyFeaturesEnabled: true,
      spotifyClientId: true,
      spotifyClientSecret: true,
      spotifyUsername: true,
    },
  });

  return normalizeSpotifyUserFeatureConfig({
    enabled: preferences?.spotifyFeaturesEnabled,
    clientId: preferences?.spotifyClientId,
    clientSecret: preferences?.spotifyClientSecret,
    username: preferences?.spotifyUsername,
  });
}

function buildSpotifyUserFeatureCredentialDiagnostics(
  config: SpotifyUserFeatureConfig,
): SpotifyUserFeatureCredentialDiagnostics {
  return {
    enabled: config.enabled,
    username: config.username,
    clientIdPreview: createSpotifyClientIdPreview(config.clientId),
    clientSecretLength: config.clientSecret.length,
  };
}

async function requestSpotifyAppAccessToken(
  config: SpotifyUserFeatureConfig,
): Promise<string> {
  const cacheKey = getSpotifyTokenCacheKey(config);
  const cached = spotifyAppTokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + SPOTIFY_TOKEN_EXPIRY_SKEW_MS) {
    return cached.accessToken;
  }

  const response = await fetch(SPOTIFY_ACCOUNTS_TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
        "utf8",
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }).toString(),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const errorMessage = readSpotifyErrorMessage(payload);
    throw new UserSpotifyFeatureApiError(
      errorMessage?.toLowerCase().includes("invalid client")
        ? "Spotify app credentials were rejected. Check the Client ID and Client Secret in Settings."
        : (errorMessage ?? "Spotify app authentication failed."),
      response.status === 429 ? 429 : 400,
      "spotify_client_credentials_failed",
    );
  }

  const record = asRecord(payload);
  const accessToken =
    typeof record?.access_token === "string" ? record.access_token : null;
  const expiresInSeconds =
    typeof record?.expires_in === "number" && Number.isFinite(record.expires_in)
      ? record.expires_in
      : 3600;

  if (!accessToken) {
    throw new UserSpotifyFeatureApiError(
      "Spotify app authentication returned an invalid token response.",
      502,
      "spotify_token_invalid",
    );
  }

  spotifyAppTokenCache.set(cacheKey, {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });

  return accessToken;
}

export async function testUserSpotifyFeatureCredentials(
  userId: string,
): Promise<UserSpotifyFeatureCredentialTestResult> {
  const config = await getUserSpotifyFeatureConfig(userId);
  const diagnostics = buildSpotifyUserFeatureCredentialDiagnostics(config);

  if (!isSpotifyUserFeatureConfigComplete(config)) {
    return {
      ok: false,
      status: 412,
      message:
        "Spotify settings are incomplete. Save Client ID, Client Secret, and Username in Settings first.",
      code: "settings_incomplete",
      diagnostics,
    };
  }

  try {
    await requestSpotifyAppAccessToken(config);

    return {
      ok: true,
      status: 200,
      message:
        "Spotify app credentials were accepted. Public playlist access should be ready.",
      code: null,
      diagnostics,
    };
  } catch (error) {
    if (error instanceof UserSpotifyFeatureApiError) {
      return {
        ok: false,
        status: error.status,
        message: error.message,
        code: error.code,
        diagnostics,
      };
    }

    throw error;
  }
}

async function fetchSpotifyPublicApiJsonWithConfig<T>(
  config: SpotifyUserFeatureConfig,
  pathname: string,
  searchParams?: URLSearchParams,
  retried = false,
): Promise<T> {
  const accessToken = await requestSpotifyAppAccessToken(config);
  const url = new URL(`${SPOTIFY_WEB_API_BASE_URL}${pathname}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse(response);

  if (response.status === 401 && !retried) {
    clearSpotifyTokenCache(config);
    return fetchSpotifyPublicApiJsonWithConfig<T>(
      config,
      pathname,
      searchParams,
      true,
    );
  }

  if (!response.ok) {
    throw buildSpotifyApiError({
      pathname,
      status: response.status,
      payload,
    });
  }

  return payload as T;
}

export async function fetchUserSpotifyPublicApiJson<T>({
  userId,
  pathname,
  searchParams,
}: FetchUserSpotifyPublicApiJsonOptions): Promise<T> {
  const config = await getUserSpotifyFeatureConfig(userId);
  if (!isSpotifyUserFeatureConfigComplete(config)) {
    throw new UserSpotifyFeatureApiError(
      "Spotify settings are incomplete. Save Client ID, Client Secret, and Username in Settings first.",
      412,
      "settings_incomplete",
    );
  }

  return fetchSpotifyPublicApiJsonWithConfig<T>(config, pathname, searchParams);
}

export async function fetchUserSpotifyPublicPlaylistsJson<T>({
  userId,
  searchParams,
}: FetchUserSpotifyPublicPlaylistsJsonOptions): Promise<T> {
  const config = await getUserSpotifyFeatureConfig(userId);
  if (!isSpotifyUserFeatureConfigComplete(config)) {
    throw new UserSpotifyFeatureApiError(
      "Spotify settings are incomplete. Save Client ID, Client Secret, and Username in Settings first.",
      412,
      "settings_incomplete",
    );
  }

  return fetchSpotifyPublicApiJsonWithConfig<T>(
    config,
    `/users/${encodeURIComponent(config.username)}/playlists`,
    searchParams,
  );
}
