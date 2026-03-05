const FRONTEND_SPOTIFY_CALLBACK_PATH = "/auth/spotify/callback";
const DEFAULT_SPOTIFY_POST_AUTH_PATH = "/library";
const SPOTIFY_CALLBACK_TRACE_QUERY_PARAM = "trace";

function toSameOriginPath(
  pathOrUrl: string | null | undefined,
  origin: string,
): string {
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
  const sameOriginPath = toSameOriginPath(next, origin);
  return sameOriginPath === "/"
    ? DEFAULT_SPOTIFY_POST_AUTH_PATH
    : sameOriginPath;
}

export function buildSpotifyFrontendRedirectUri(options: {
  next: string | null | undefined;
  origin: string;
  traceId?: string;
}): string {
  const callbackUrl = new URL(FRONTEND_SPOTIFY_CALLBACK_PATH, options.origin);
  callbackUrl.searchParams.set(
    "next",
    resolveSpotifyPostAuthPath(options.next, options.origin),
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
  FRONTEND_SPOTIFY_CALLBACK_PATH,
  SPOTIFY_CALLBACK_TRACE_QUERY_PARAM,
};
