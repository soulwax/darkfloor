// File: apps/web/src/lib/server/songbird-token.ts

import "server-only";

import { env } from "@/env";

const TOKEN_ENDPOINT = "/api/auth/token";
const TOKEN_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_SKEW_MS = 30_000;
const DEFAULT_HEALTH_URI = "/api/health";

type UnknownRecord = Record<string, unknown>;

export type SongbirdAccessToken = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scopes: string[];
  expiresAt: number;
};

export class SongbirdTokenError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "SongbirdTokenError";
    this.status = status;
    this.details = details;
  }
}

let cachedToken: SongbirdAccessToken | null = null;
let pendingTokenRequest: Promise<SongbirdAccessToken> | null = null;

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null) return null;
  return value as UnknownRecord;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizePath(pathname: string): string {
  return pathname.trim().replace(/^\/+/, "");
}

export function joinSongbirdUrl(baseUrl: string, pathname: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPathname = normalizePath(pathname);

  return normalizedPathname.length === 0
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${normalizedPathname}`;
}

export function getSongbirdHealthUri(): string {
  const configured = env.SONGBIRD_API_HEALTH_URI?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_HEALTH_URI;
}

export function getSongbirdApiBaseUrl(): string {
  const configured = env.SONGBIRD_API_URL?.trim();
  if (!configured) {
    throw new SongbirdTokenError(500, "SONGBIRD_API_URL is not configured");
  }

  return configured;
}

function getUniversalKey(): string {
  const key = env.UNIVERSAL_KEY?.trim();
  if (!key) {
    throw new SongbirdTokenError(500, "UNIVERSAL_KEY is not configured");
  }

  return key;
}

function isTokenUsable(token: SongbirdAccessToken): boolean {
  return token.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function parseTokenResponse(
  payload: unknown,
): Omit<SongbirdAccessToken, "expiresAt"> {
  const parsed = asRecord(payload);
  if (!parsed) {
    throw new SongbirdTokenError(
      502,
      "Token endpoint returned an invalid response payload",
    );
  }

  const accessToken =
    typeof parsed.accessToken === "string" ? parsed.accessToken.trim() : "";
  const tokenType =
    typeof parsed.tokenType === "string" && parsed.tokenType.trim().length > 0
      ? parsed.tokenType.trim()
      : "Bearer";
  const expiresIn = parseNumber(parsed.expiresIn);

  if (!accessToken) {
    throw new SongbirdTokenError(
      502,
      "Token endpoint response did not include accessToken",
      payload,
    );
  }

  if (!expiresIn || expiresIn <= 0) {
    throw new SongbirdTokenError(
      502,
      "Token endpoint response did not include a valid expiresIn",
      payload,
    );
  }

  const scopes = Array.isArray(parsed.scopes)
    ? parsed.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  return {
    accessToken,
    tokenType,
    expiresIn,
    scopes,
  };
}

async function parseErrorPayload(response: Response): Promise<{
  message: string;
  details?: unknown;
}> {
  const fallbackMessage = `Token endpoint request failed with status ${response.status}`;

  try {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as unknown;
      const record = asRecord(body);
      const message =
        (record && typeof record.message === "string" && record.message.trim()) ||
        (record && typeof record.error === "string" && record.error.trim()) ||
        fallbackMessage;

      return {
        message,
        details: body,
      };
    }

    const text = (await response.text()).trim();
    if (text.length === 0) {
      return { message: fallbackMessage };
    }

    return {
      message: text,
      details: { upstreamText: text.slice(0, 400) },
    };
  } catch {
    return { message: fallbackMessage };
  }
}

async function fetchSongbirdToken(): Promise<SongbirdAccessToken> {
  const tokenUrl = joinSongbirdUrl(getSongbirdApiBaseUrl(), TOKEN_ENDPOINT);
  const universalKey = getUniversalKey();

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: universalKey }),
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token endpoint fetch failed";
    throw new SongbirdTokenError(502, message);
  }

  if (!response.ok) {
    const { message, details } = await parseErrorPayload(response);
    throw new SongbirdTokenError(response.status, message, details);
  }

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new SongbirdTokenError(502, "Token endpoint returned invalid JSON");
  }

  const parsed = parseTokenResponse(payload);
  return {
    ...parsed,
    expiresAt: Date.now() + parsed.expiresIn * 1000,
  };
}

export function clearSongbirdTokenCache(): void {
  cachedToken = null;
  pendingTokenRequest = null;
}

export async function getSongbirdAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<SongbirdAccessToken> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && cachedToken && isTokenUsable(cachedToken)) {
    return cachedToken;
  }

  if (!forceRefresh && pendingTokenRequest) {
    return pendingTokenRequest;
  }

  let requestPromise: Promise<SongbirdAccessToken>;
  requestPromise = fetchSongbirdToken().finally(() => {
    if (pendingTokenRequest === requestPromise) {
      pendingTokenRequest = null;
    }
  });
  pendingTokenRequest = requestPromise;

  const token = await requestPromise;
  cachedToken = token;

  return token;
}
