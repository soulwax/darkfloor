// File: apps/web/src/services/spotifyAuthClient.ts

import {
  isClientAuthDebugEnabled,
  logAuthClientDebug,
} from "@/utils/authDebugClient";

const DEFAULT_AUTH_API_ORIGIN = "https://www.darkfloor.one";
const SPOTIFY_BROWSER_SIGNIN_PATH = "/api/auth/signin/spotify";
const FRONTEND_SPOTIFY_CALLBACK_PATH = "/auth/spotify/callback";
const DEFAULT_POST_AUTH_PATH = "/library";
const FRONTEND_CALLBACK_TRACE_PARAM = "trace";
const CSRF_COOKIE_NAME = "sb_csrf_token";
const APP_REFRESH_COOKIE_NAME = "sb_app_refresh_token";
const OAUTH_SESSION_COOKIE_NAME = "sb_spotify_oauth_sid";
const EXPIRY_SKEW_MS = 15_000;
const TOKEN_STATE_STORAGE_KEY = "sb_spotify_auth_state_v1";
const LOGIN_TRACE_STORAGE_KEY = "sb_spotify_auth_trace_v1";
const LOGOUT_MARKER_STORAGE_KEY = "sb_spotify_logout_marker_v1";

const HASH_TOKEN_KEYS = [
  "access_token",
  "token_type",
  "expires_in",
  "spotify_access_token",
  "spotify_token_type",
  "spotify_expires_in",
] as const;

const REQUIRED_HASH_TOKEN_KEYS = [
  "access_token",
  "token_type",
  "expires_in",
] as const;

type HashTokenKey = (typeof HASH_TOKEN_KEYS)[number];
type RequiredHashTokenKey = (typeof REQUIRED_HASH_TOKEN_KEYS)[number];

type HashTokenPresence = Record<HashTokenKey, boolean>;

type TokenState = {
  accessToken: string | null;
  tokenType: string;
  expiresAtMs: number | null;
  spotifyAccessToken: string | null;
  spotifyTokenType: string;
  spotifyExpiresAtMs: number | null;
};

type HashTokenPayload = {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
  spotifyAccessToken: string | null;
  spotifyTokenType: string;
  spotifyExpiresIn: number | null;
};

type HashTokenParseResult = {
  payload: HashTokenPayload | null;
  keyPresence: HashTokenPresence;
  missingKeys: RequiredHashTokenKey[];
};

type PersistedTokenState = {
  accessToken: string;
  tokenType: string;
  expiresAtMs: number | null;
  spotifyAccessToken: string | null;
  spotifyTokenType: string;
  spotifyExpiresAtMs: number | null;
};

export type SpotifyCallbackDebugInfo = {
  traceId: string | null;
  requiredHashKeys: HashTokenPresence;
  missingHashKeys: RequiredHashTokenKey[];
  authorizationHeaderSent: boolean;
  authMeStatus: number | null;
  authMeBodySnippet: string | null;
  authMeUrl: string;
  authMeRedirected: boolean | null;
  authMeFinalUrl: string | null;
};

type CallbackResult = {
  accessToken: string;
  profile: unknown;
};

export type AuthRequiredReason = "missing_csrf_token" | "unauthorized";
export type AuthRequiredEventDetail = {
  callbackUrl: string;
  reason: AuthRequiredReason;
};

export type SpotifyAuthStateEventDetail = {
  authenticated: boolean;
};

export const AUTH_REQUIRED_EVENT = "starchild:auth-required";
export const SPOTIFY_AUTH_STATE_EVENT = "starchild:spotify-auth-state";

const tokenState: TokenState = {
  accessToken: null,
  tokenType: "Bearer",
  expiresAtMs: null,
  spotifyAccessToken: null,
  spotifyTokenType: "Bearer",
  spotifyExpiresAtMs: null,
};

let refreshPromise: Promise<string> | null = null;

function logSpotifyBrowserDebug(message: string, details?: unknown): void {
  if (typeof window === "undefined") return;
  if (!isClientAuthDebugEnabled()) return;
  if (details === undefined) {
    console.log(`[Spotify Browser Login] ${message}`);
    return;
  }
  console.log(`[Spotify Browser Login] ${message}`, details);
}

function normalizeAuthOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveAuthApiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_AUTH_API_ORIGIN?.trim();
  if (configured && configured.length > 0) {
    return normalizeAuthOrigin(configured);
  }

  if (typeof window !== "undefined") {
    return normalizeAuthOrigin(window.location.origin);
  }

  return DEFAULT_AUTH_API_ORIGIN;
}

function buildAuthEndpoint(pathname: string): string {
  return `${resolveAuthApiOrigin()}${pathname}`;
}

function createDefaultHashKeyPresence(present = false): HashTokenPresence {
  return {
    access_token: present,
    token_type: present,
    expires_in: present,
    spotify_access_token: present,
    spotify_token_type: present,
    spotify_expires_in: present,
  };
}

function buildDebugInfo(overrides: {
  traceId: string | null;
  requiredHashKeys: HashTokenPresence;
  missingHashKeys: RequiredHashTokenKey[];
  authorizationHeaderSent: boolean;
  authMeStatus: number | null;
  authMeBodySnippet: string | null;
  authMeUrl: string;
  authMeRedirected: boolean | null;
  authMeFinalUrl: string | null;
}): SpotifyCallbackDebugInfo {
  return {
    traceId: overrides.traceId,
    requiredHashKeys: overrides.requiredHashKeys,
    missingHashKeys: overrides.missingHashKeys,
    authorizationHeaderSent: overrides.authorizationHeaderSent,
    authMeStatus: overrides.authMeStatus,
    authMeBodySnippet: overrides.authMeBodySnippet,
    authMeUrl: overrides.authMeUrl,
    authMeRedirected: overrides.authMeRedirected,
    authMeFinalUrl: overrides.authMeFinalUrl,
  };
}

function sanitizeResponseSnippet(body: unknown): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
  }

  try {
    const serialized = JSON.stringify(body);
    return serialized.length > 240
      ? `${serialized.slice(0, 240)}...`
      : serialized;
  } catch {
    return null;
  }
}

function generateTraceId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const randomChunk = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${randomChunk}`;
}

function persistTraceId(traceId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOGIN_TRACE_STORAGE_KEY, traceId);
}

function readStoredTraceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(LOGIN_TRACE_STORAGE_KEY);
}

function clearStoredTraceId(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LOGIN_TRACE_STORAGE_KEY);
}

function markSpotifyLoggedOut(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOGOUT_MARKER_STORAGE_KEY, Date.now().toString());
}

function clearSpotifyLoggedOutMarker(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOGOUT_MARKER_STORAGE_KEY);
}

function isSpotifyMarkedLoggedOut(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LOGOUT_MARKER_STORAGE_KEY) !== null;
}

function getTraceIdFromCallbackUrl(): string | null {
  if (typeof window === "undefined") return null;

  const searchTrace = new URLSearchParams(window.location.search).get(
    FRONTEND_CALLBACK_TRACE_PARAM,
  );

  if (searchTrace && searchTrace.trim().length > 0) {
    persistTraceId(searchTrace);
    return searchTrace;
  }

  return readStoredTraceId();
}

function dispatchSpotifyAuthState(authenticated: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SpotifyAuthStateEventDetail>(SPOTIFY_AUTH_STATE_EVENT, {
      detail: { authenticated },
    }),
  );
}

function isTokenUsable(expiresAtMs: number | null): boolean {
  return expiresAtMs === null || expiresAtMs - EXPIRY_SKEW_MS > Date.now();
}

function persistTokenStateToStorage(): void {
  if (typeof window === "undefined") return;

  if (!tokenState.accessToken) {
    window.sessionStorage.removeItem(TOKEN_STATE_STORAGE_KEY);
    return;
  }

  const serialized: PersistedTokenState = {
    accessToken: tokenState.accessToken,
    tokenType: tokenState.tokenType,
    expiresAtMs: tokenState.expiresAtMs,
    spotifyAccessToken: tokenState.spotifyAccessToken,
    spotifyTokenType: tokenState.spotifyTokenType,
    spotifyExpiresAtMs: tokenState.spotifyExpiresAtMs,
  };

  window.sessionStorage.setItem(
    TOKEN_STATE_STORAGE_KEY,
    JSON.stringify(serialized),
  );
}

function applyTokenState(nextState: TokenState): void {
  tokenState.accessToken = nextState.accessToken;
  tokenState.tokenType = nextState.tokenType;
  tokenState.expiresAtMs = nextState.expiresAtMs;
  tokenState.spotifyAccessToken = nextState.spotifyAccessToken;
  tokenState.spotifyTokenType = nextState.spotifyTokenType;
  tokenState.spotifyExpiresAtMs = nextState.spotifyExpiresAtMs;
  persistTokenStateToStorage();
  dispatchSpotifyAuthState(Boolean(nextState.accessToken));
}

function buildTokenStateFromHashPayload(payload: HashTokenPayload): TokenState {
  return {
    accessToken: payload.accessToken,
    tokenType: payload.tokenType || "Bearer",
    expiresAtMs: resolveExpiresAt(payload.expiresIn),
    spotifyAccessToken: payload.spotifyAccessToken,
    spotifyTokenType: payload.spotifyTokenType || "Bearer",
    spotifyExpiresAtMs: resolveExpiresAt(payload.spotifyExpiresIn),
  };
}

function parsePersistedTokenState(raw: unknown): TokenState | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const accessToken = record.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return null;
  }

  const tokenType =
    typeof record.tokenType === "string" && record.tokenType.length > 0
      ? record.tokenType
      : "Bearer";
  const expiresAtMs =
    typeof record.expiresAtMs === "number" &&
    Number.isFinite(record.expiresAtMs)
      ? record.expiresAtMs
      : null;
  const spotifyAccessToken =
    typeof record.spotifyAccessToken === "string"
      ? record.spotifyAccessToken
      : null;
  const spotifyTokenType =
    typeof record.spotifyTokenType === "string" &&
    record.spotifyTokenType.length > 0
      ? record.spotifyTokenType
      : "Bearer";
  const spotifyExpiresAtMs =
    typeof record.spotifyExpiresAtMs === "number" &&
    Number.isFinite(record.spotifyExpiresAtMs)
      ? record.spotifyExpiresAtMs
      : null;

  return {
    accessToken,
    tokenType,
    expiresAtMs,
    spotifyAccessToken,
    spotifyTokenType,
    spotifyExpiresAtMs,
  };
}

function hydrateTokenStateFromStorage(): boolean {
  if (typeof window === "undefined") return false;

  const raw = window.sessionStorage.getItem(TOKEN_STATE_STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const restored = parsePersistedTokenState(parsed);
    if (!restored || !isTokenUsable(restored.expiresAtMs)) {
      window.sessionStorage.removeItem(TOKEN_STATE_STORAGE_KEY);
      return false;
    }
    applyTokenState(restored);
    return true;
  } catch {
    window.sessionStorage.removeItem(TOKEN_STATE_STORAGE_KEY);
    return false;
  }
}

export class SpotifyAuthClientError extends Error {
  readonly status: number | null;
  readonly debugInfo: SpotifyCallbackDebugInfo | null;

  constructor(
    message: string,
    status: number | null = null,
    debugInfo: SpotifyCallbackDebugInfo | null = null,
  ) {
    super(message);
    this.name = "SpotifyAuthClientError";
    this.status = status;
    this.debugInfo = debugInfo;
  }
}

function parseExpiresIn(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveExpiresAt(expiresInSeconds: number | null): number | null {
  if (!expiresInSeconds) return null;
  return Date.now() + expiresInSeconds * 1000;
}

function toSameOriginPath(pathOrUrl: string, origin: string): string {
  if (!pathOrUrl) return "/";

  if (pathOrUrl.startsWith("/")) {
    return pathOrUrl.startsWith(FRONTEND_SPOTIFY_CALLBACK_PATH)
      ? "/"
      : pathOrUrl;
  }

  try {
    const parsed = new URL(pathOrUrl);
    if (parsed.origin !== origin) return "/";
    const sameOriginPath =
      `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    if (sameOriginPath.startsWith(FRONTEND_SPOTIFY_CALLBACK_PATH)) return "/";
    return sameOriginPath;
  } catch {
    return "/";
  }
}

function resolvePostAuthPath(path: string): string {
  return path === "/" ? DEFAULT_POST_AUTH_PATH : path;
}

function parseHashTokens(hash: string): HashTokenParseResult {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) {
    return {
      payload: null,
      keyPresence: createDefaultHashKeyPresence(false),
      missingKeys: [...REQUIRED_HASH_TOKEN_KEYS],
    };
  }

  const params = new URLSearchParams(fragment);
  const keyPresence = createDefaultHashKeyPresence(false);

  for (const key of HASH_TOKEN_KEYS) {
    const value = params.get(key);
    keyPresence[key] = typeof value === "string" && value.trim().length > 0;
  }

  const missingKeys = REQUIRED_HASH_TOKEN_KEYS.filter(
    (key) => !keyPresence[key],
  );

  if (missingKeys.length > 0) {
    return {
      payload: null,
      keyPresence,
      missingKeys,
    };
  }

  const spotifyAccessTokenRaw = params.get("spotify_access_token");

  return {
    payload: {
      accessToken: params.get("access_token") ?? "",
      tokenType: params.get("token_type") ?? "Bearer",
      expiresIn: parseExpiresIn(params.get("expires_in")),
      spotifyAccessToken:
        typeof spotifyAccessTokenRaw === "string" &&
        spotifyAccessTokenRaw.trim().length > 0
          ? spotifyAccessTokenRaw
          : null,
      spotifyTokenType: params.get("spotify_token_type") ?? "Bearer",
      spotifyExpiresIn: parseExpiresIn(params.get("spotify_expires_in")),
    },
    keyPresence,
    missingKeys,
  };
}

export function hasSpotifyTokenHashFragment(hash: string): boolean {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return false;

  const params = new URLSearchParams(fragment);
  const appAccessToken = params.get("access_token");
  const spotifyAccessToken = params.get("spotify_access_token");

  return (
    (typeof appAccessToken === "string" && appAccessToken.trim().length > 0) ||
    (typeof spotifyAccessToken === "string" &&
      spotifyAccessToken.trim().length > 0)
  );
}

function readCookieValue(
  cookieHeader: string,
  cookieName: string,
): string | null {
  const encodedName = `${encodeURIComponent(cookieName)}=`;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!match) return null;
  return decodeURIComponent(match.slice(encodedName.length));
}

function setTokenState(payload: HashTokenPayload): void {
  applyTokenState(buildTokenStateFromHashPayload(payload));
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    return text.length > 0 ? { message: text } : {};
  }

  return response.json().catch(() => ({}));
}

function getMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim().length > 0) return message;
  const error = record.error;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return null;
}

function getAccessTokenFromBody(body: unknown): {
  accessToken: string | null;
  tokenType: string;
  expiresIn: number | null;
} {
  if (!body || typeof body !== "object") {
    return {
      accessToken: null,
      tokenType: "Bearer",
      expiresIn: null,
    };
  }

  const record = body as Record<string, unknown>;
  const accessToken =
    typeof record.accessToken === "string"
      ? record.accessToken
      : typeof record.access_token === "string"
        ? record.access_token
        : typeof record.token === "string"
          ? record.token
          : null;

  const tokenType =
    typeof record.tokenType === "string"
      ? record.tokenType
      : typeof record.token_type === "string"
        ? record.token_type
        : "Bearer";

  const expiresValue =
    typeof record.expiresIn === "number"
      ? record.expiresIn
      : typeof record.expires_in === "number"
        ? record.expires_in
        : typeof record.expiresIn === "string"
          ? parseExpiresIn(record.expiresIn)
          : typeof record.expires_in === "string"
            ? parseExpiresIn(record.expires_in)
            : null;

  return {
    accessToken,
    tokenType,
    expiresIn:
      typeof expiresValue === "number" && Number.isFinite(expiresValue)
        ? expiresValue
        : null,
  };
}

export function resolveFrontendRedirectPath(
  next: string | null | undefined,
): string {
  if (typeof window === "undefined") return "/";
  const sameOriginPath = toSameOriginPath(next ?? "/", window.location.origin);
  return resolvePostAuthPath(sameOriginPath);
}

export function buildSpotifyFrontendCallbackUrl(
  nextPath: string,
  traceId?: string,
): string {
  if (typeof window === "undefined") {
    throw new Error("buildSpotifyFrontendCallbackUrl must run in the browser");
  }

  const safeNext = resolvePostAuthPath(
    toSameOriginPath(nextPath, window.location.origin),
  );
  const callbackUrl = new URL(
    FRONTEND_SPOTIFY_CALLBACK_PATH,
    window.location.origin,
  );
  callbackUrl.searchParams.set("next", safeNext);
  if (traceId) {
    callbackUrl.searchParams.set(FRONTEND_CALLBACK_TRACE_PARAM, traceId);
  }
  logSpotifyBrowserDebug("Built frontend Spotify callback URL", {
    requestedNextPath: nextPath,
    safeNextPath: safeNext,
    traceId,
    callbackUrl: callbackUrl.toString(),
  });
  return callbackUrl.toString();
}

export function buildSpotifyLoginUrl(
  nextPath: string,
  traceId?: string,
): string {
  const effectiveTraceId = traceId ?? generateTraceId();
  const frontendRedirectUri = buildSpotifyFrontendCallbackUrl(
    nextPath,
    effectiveTraceId,
  );
  const params = new URLSearchParams({
    frontend_redirect_uri: frontendRedirectUri,
  });
  const loginEndpoint = buildAuthEndpoint("/api/auth/spotify");
  const loginUrl = `${loginEndpoint}?${params.toString()}`;
  logSpotifyBrowserDebug("Built direct Spotify OAuth URL", {
    requestedNextPath: nextPath,
    traceId: effectiveTraceId,
    frontendRedirectUri,
    loginEndpoint,
    loginUrl,
  });
  return loginUrl;
}

export function buildSpotifyBrowserSignInUrl(
  nextPath: string,
  traceId?: string,
): string {
  if (typeof window === "undefined") {
    throw new Error("buildSpotifyBrowserSignInUrl must run in the browser");
  }

  const effectiveTraceId = traceId ?? generateTraceId();
  const safeNext = resolvePostAuthPath(
    toSameOriginPath(nextPath, window.location.origin),
  );
  const signInUrl = new URL(
    SPOTIFY_BROWSER_SIGNIN_PATH,
    window.location.origin,
  );
  signInUrl.searchParams.set("callbackUrl", safeNext);
  signInUrl.searchParams.set(FRONTEND_CALLBACK_TRACE_PARAM, effectiveTraceId);

  logSpotifyBrowserDebug("Built browser Spotify sign-in shim URL", {
    requestedNextPath: nextPath,
    safeNextPath: safeNext,
    traceId: effectiveTraceId,
    signInUrl: signInUrl.toString(),
  });

  return signInUrl.toString();
}

export function startSpotifyLogin(
  nextPath: string,
  navigate?: (url: string) => void,
): void {
  if (typeof window === "undefined") return;

  clearSpotifyLoggedOutMarker();

  const safeNextPath = resolveFrontendRedirectPath(nextPath);
  const traceId = generateTraceId();
  persistTraceId(traceId);
  const directLoginUrl = buildSpotifyLoginUrl(safeNextPath, traceId);
  const authApiOrigin = (() => {
    try {
      return new URL(directLoginUrl).origin;
    } catch {
      return resolveAuthApiOrigin();
    }
  })();
  const currentOrigin = window.location.origin;
  const crossOriginAuthStart = authApiOrigin !== currentOrigin;

  logAuthClientDebug("Spotify login initiated", {
    traceId,
    nextPath,
    safeNextPath,
    directLoginUrl,
    authApiOrigin,
    currentOrigin,
    crossOriginAuthStart,
    resolvedAuthApiOrigin: resolveAuthApiOrigin(),
    currentUrl: window.location.href,
  });

  logSpotifyBrowserDebug("Navigating browser to Spotify OAuth start", {
    traceId,
    from: window.location.href,
    to: directLoginUrl,
    authApiOrigin,
    currentOrigin,
    crossOriginAuthStart,
  });
  if (navigate) {
    navigate(directLoginUrl);
    return;
  }

  window.location.assign(directLoginUrl);
}

export function getInMemoryAccessToken(): string | null {
  return tokenState.accessToken;
}

export function clearInMemoryAccessToken(): void {
  applyTokenState({
    accessToken: null,
    tokenType: "Bearer",
    expiresAtMs: null,
    spotifyAccessToken: null,
    spotifyTokenType: "Bearer",
    spotifyExpiresAtMs: null,
  });
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;

  const encodedName = encodeURIComponent(name);
  const baseCookie = `${encodedName}=; Max-Age=0; Path=/`;

  document.cookie = baseCookie;
  document.cookie = `${baseCookie}; SameSite=Lax`;
  document.cookie = `${baseCookie}; SameSite=None; Secure`;
}

export function clearSpotifyBrowserSessionArtifacts(): void {
  markSpotifyLoggedOut();
  clearInMemoryAccessToken();
  clearStoredTraceId();

  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(TOKEN_STATE_STORAGE_KEY);

  clearCookie(CSRF_COOKIE_NAME);
  clearCookie(APP_REFRESH_COOKIE_NAME);
  clearCookie(OAUTH_SESSION_COOKIE_NAME);
}

function notifyAuthRequired(reason: AuthRequiredReason): void {
  if (typeof window === "undefined") return;
  const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
  const callbackUrl = window.location.pathname.startsWith(
    FRONTEND_SPOTIFY_CALLBACK_PATH,
  )
    ? resolveFrontendRedirectPath(
        new URLSearchParams(window.location.search).get("next"),
      )
    : resolveFrontendRedirectPath(currentPathWithSearch);

  window.dispatchEvent(
    new CustomEvent<AuthRequiredEventDetail>(AUTH_REQUIRED_EVENT, {
      detail: { callbackUrl, reason },
    }),
  );
}

function handleUnauthorized(reason: AuthRequiredReason): void {
  clearInMemoryAccessToken();
  notifyAuthRequired(reason);
}

export function getCsrfTokenFromCookies(cookieHeader?: string): string | null {
  if (typeof window === "undefined" && !cookieHeader) return null;
  const source = cookieHeader ?? document.cookie;
  return readCookieValue(source, CSRF_COOKIE_NAME);
}

export async function getCurrentUser(
  accessToken: string,
  context?: {
    traceId: string | null;
    keyPresence: HashTokenPresence;
    missingKeys: RequiredHashTokenKey[];
  },
): Promise<unknown> {
  const authMeEndpoint = buildAuthEndpoint("/api/auth/me");
  const authorizationHeaderSent = true;
  logAuthClientDebug("Fetching authenticated profile", {
    traceId: context?.traceId ?? null,
    endpoint: authMeEndpoint,
    authorizationHeaderSent,
  });

  const response = await fetch(authMeEndpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseResponseBody(response);
    const message =
      getMessageFromBody(body) ??
      `GET ${authMeEndpoint} failed with status ${response.status}`;

    const debugInfo = buildDebugInfo({
      traceId: context?.traceId ?? readStoredTraceId(),
      requiredHashKeys:
        context?.keyPresence ?? createDefaultHashKeyPresence(false),
      missingHashKeys: context?.missingKeys ?? [...REQUIRED_HASH_TOKEN_KEYS],
      authorizationHeaderSent,
      authMeStatus: response.status,
      authMeBodySnippet: sanitizeResponseSnippet(body),
      authMeUrl: authMeEndpoint,
      authMeRedirected: response.redirected,
      authMeFinalUrl: response.url || null,
    });

    logAuthClientDebug("Authenticated profile request failed", debugInfo);

    throw new SpotifyAuthClientError(message, response.status, debugInfo);
  }

  logAuthClientDebug("Authenticated profile request succeeded", {
    traceId: context?.traceId ?? readStoredTraceId(),
    status: response.status,
    redirected: response.redirected,
    finalUrl: response.url || null,
  });

  return parseResponseBody(response);
}

type RefreshAccessTokenOptions = {
  notifyOnUnauthorized?: boolean;
};

export async function refreshAccessToken(
  options: RefreshAccessTokenOptions = {},
): Promise<string> {
  if (isSpotifyMarkedLoggedOut()) {
    clearInMemoryAccessToken();
    throw new SpotifyAuthClientError("Spotify session is signed out", 401);
  }

  const notifyOnUnauthorized = options.notifyOnUnauthorized ?? true;
  const refreshEndpoint = buildAuthEndpoint("/api/auth/spotify/refresh");
  const csrfToken = getCsrfTokenFromCookies();
  if (!csrfToken) {
    if (notifyOnUnauthorized) {
      handleUnauthorized("missing_csrf_token");
    } else {
      clearInMemoryAccessToken();
    }
    throw new SpotifyAuthClientError(
      `${CSRF_COOKIE_NAME} cookie is missing`,
      401,
    );
  }

  logAuthClientDebug("Refreshing Spotify app access token", {
    endpoint: refreshEndpoint,
    csrfTokenPresent: true,
  });

  const response = await fetch(refreshEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    cache: "no-store",
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    if (response.status === 401) {
      if (notifyOnUnauthorized) {
        handleUnauthorized("unauthorized");
      } else {
        clearInMemoryAccessToken();
      }
    }
    const message =
      getMessageFromBody(body) ??
      `POST ${refreshEndpoint} failed with status ${response.status}`;
    logAuthClientDebug("Refresh token request failed", {
      status: response.status,
      body: sanitizeResponseSnippet(body),
      endpoint: refreshEndpoint,
    });
    throw new SpotifyAuthClientError(message, response.status);
  }

  const tokenPayload = getAccessTokenFromBody(body);
  if (!tokenPayload.accessToken) {
    throw new SpotifyAuthClientError(
      "Refresh response did not include access token",
      500,
    );
  }

  setTokenState({
    accessToken: tokenPayload.accessToken,
    tokenType: tokenPayload.tokenType,
    expiresIn: tokenPayload.expiresIn,
    spotifyAccessToken: tokenState.spotifyAccessToken,
    spotifyTokenType: tokenState.spotifyTokenType,
    spotifyExpiresIn: null,
  });

  logAuthClientDebug("Refresh token request succeeded", {
    endpoint: refreshEndpoint,
  });

  return tokenPayload.accessToken;
}

export async function ensureAccessToken(): Promise<string | null> {
  if (isSpotifyMarkedLoggedOut()) {
    clearInMemoryAccessToken();
    return null;
  }

  if (tokenState.accessToken && isTokenUsable(tokenState.expiresAtMs)) {
    return tokenState.accessToken;
  }

  if (!tokenState.accessToken && hydrateTokenStateFromStorage()) {
    return tokenState.accessToken;
  }

  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  try {
    return await refreshPromise;
  } catch {
    return null;
  }
}

export async function handleSpotifyCallbackHash(): Promise<CallbackResult> {
  if (typeof window === "undefined") {
    throw new SpotifyAuthClientError(
      "Callback handling requires browser context",
    );
  }

  const traceId = getTraceIdFromCallbackUrl();
  const parsed = parseHashTokens(window.location.hash);

  if (!parsed.payload) {
    const authMeEndpoint = buildAuthEndpoint("/api/auth/me");
    const debugInfo = buildDebugInfo({
      traceId,
      requiredHashKeys: parsed.keyPresence,
      missingHashKeys: parsed.missingKeys,
      authorizationHeaderSent: false,
      authMeStatus: null,
      authMeBodySnippet: null,
      authMeUrl: authMeEndpoint,
      authMeRedirected: null,
      authMeFinalUrl: null,
    });

    logAuthClientDebug("Spotify callback hash validation failed", debugInfo);

    throw new SpotifyAuthClientError(
      `Callback hash missing required token keys: ${parsed.missingKeys.join(", ")}`,
      401,
      debugInfo,
    );
  }

  logAuthClientDebug("Spotify callback hash parsed", {
    traceId,
    requiredHashKeys: parsed.keyPresence,
    missingHashKeys: parsed.missingKeys,
  });

  clearSpotifyLoggedOutMarker();
  setTokenState(parsed.payload);

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);

  let profile: unknown;
  try {
    profile = await getCurrentUser(parsed.payload.accessToken, {
      traceId,
      keyPresence: parsed.keyPresence,
      missingKeys: parsed.missingKeys,
    });
    clearStoredTraceId();
  } catch (error) {
    clearInMemoryAccessToken();
    throw error;
  }

  return {
    accessToken: parsed.payload.accessToken,
    profile,
  };
}

export async function restoreSpotifySession(): Promise<boolean> {
  if (isSpotifyMarkedLoggedOut()) {
    clearInMemoryAccessToken();
    return false;
  }

  if (tokenState.accessToken && isTokenUsable(tokenState.expiresAtMs)) {
    return true;
  }

  if (hydrateTokenStateFromStorage()) {
    return true;
  }

  const csrfToken = getCsrfTokenFromCookies();
  if (!csrfToken) {
    clearInMemoryAccessToken();
    return false;
  }

  try {
    await refreshAccessToken({ notifyOnUnauthorized: false });
    return Boolean(tokenState.accessToken);
  } catch {
    clearInMemoryAccessToken();
    return false;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const sendRequest = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }

    return fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });
  };

  let token = await ensureAccessToken();
  const response = await sendRequest(token);

  if (response.status !== 401) {
    return response;
  }

  token = await refreshAccessToken().catch(() => null);
  if (!token) {
    return response;
  }

  const retriedResponse = await sendRequest(token);
  if (retriedResponse.status === 401) {
    handleUnauthorized("unauthorized");
  }

  return retriedResponse;
}

export const login = startSpotifyLogin;
export const handleCallback = handleSpotifyCallbackHash;
export const refresh = refreshAccessToken;
