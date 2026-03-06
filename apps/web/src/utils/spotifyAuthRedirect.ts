const FRONTEND_SPOTIFY_CALLBACK_PATH = "/auth/spotify/callback";
const DEFAULT_SPOTIFY_POST_AUTH_PATH = "/library";
const SPOTIFY_CALLBACK_TRACE_QUERY_PARAM = "trace";
const DEFAULT_FRONTEND_ORIGIN = "https://www.darkfloor.org";
const CANONICAL_FRONTEND_HOSTNAME = "www.darkfloor.org";
const FRONTEND_ORIGIN_ALIASES = new Set([
  "darkfloor.org",
  CANONICAL_FRONTEND_HOSTNAME,
]);

function normalizeFrontendOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    if (FRONTEND_ORIGIN_ALIASES.has(parsed.hostname.toLowerCase())) {
      return DEFAULT_FRONTEND_ORIGIN;
    }

    return parsed.origin;
  } catch {
    return trimmed;
  }
}

function toSameOriginPath(
  pathOrUrl: string | null | undefined,
  origin: string,
): string {
  const normalizedOrigin = normalizeFrontendOrigin(origin);
  if (!pathOrUrl) return "/";

  if (pathOrUrl.startsWith("/")) {
    return pathOrUrl.startsWith(FRONTEND_SPOTIFY_CALLBACK_PATH)
      ? "/"
      : pathOrUrl;
  }

  try {
    const parsed = new URL(pathOrUrl);
    if (normalizeFrontendOrigin(parsed.origin) !== normalizedOrigin) return "/";

    const sameOriginPath =
      `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    return sameOriginPath.startsWith(FRONTEND_SPOTIFY_CALLBACK_PATH)
      ? "/"
      : sameOriginPath;
  } catch {
    return "/";
  }
}

export function resolveSpotifyPostAuthPath(
  next: string | null | undefined,
  origin: string,
): string {
  const normalizedOrigin = normalizeFrontendOrigin(origin);
  const sameOriginPath = toSameOriginPath(next, normalizedOrigin);
  return sameOriginPath === "/"
    ? DEFAULT_SPOTIFY_POST_AUTH_PATH
    : sameOriginPath;
}

export function buildSpotifyFrontendRedirectUri(options: {
  next: string | null | undefined;
  origin: string;
  traceId?: string;
}): string {
  const normalizedOrigin = normalizeFrontendOrigin(options.origin);
  const callbackUrl = new URL(FRONTEND_SPOTIFY_CALLBACK_PATH, normalizedOrigin);
  callbackUrl.searchParams.set(
    "next",
    resolveSpotifyPostAuthPath(options.next, normalizedOrigin),
  );

  if (options.traceId) {
    callbackUrl.searchParams.set(
      SPOTIFY_CALLBACK_TRACE_QUERY_PARAM,
      options.traceId,
    );
  }

  return callbackUrl.toString();
}

export {
  DEFAULT_SPOTIFY_POST_AUTH_PATH,
  DEFAULT_FRONTEND_ORIGIN,
  FRONTEND_SPOTIFY_CALLBACK_PATH,
  normalizeFrontendOrigin,
  SPOTIFY_CALLBACK_TRACE_QUERY_PARAM,
};
