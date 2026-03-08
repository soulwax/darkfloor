// File: apps/web/src/app/auth/spotify/callback/page.tsx

"use client";

import {
  bootstrapSpotifyAppSession,
  SpotifyAuthClientError,
  type SpotifyCallbackDebugInfo,
  handleSpotifyCallbackHash,
  resolveFrontendRedirectPath,
  startSpotifyLogin,
} from "@/services/spotifyAuthClient";
import {
  isClientAuthDebugEnabled,
  logAuthClientDebug,
} from "@/utils/authDebugClient";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState } from "react";

type CallbackState = "pending" | "error";

function createEmptyHashPresence(): SpotifyCallbackDebugInfo["requiredHashKeys"] {
  return {
    access_token: false,
    token_type: false,
    expires_in: false,
    refresh_token: false,
    spotify_access_token: false,
    spotify_token_type: false,
    spotify_expires_in: false,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof SpotifyAuthClientError) {
    if (error.status === 403) {
      return "Spotify authorization was denied. Please try again and accept consent.";
    }
    if (error.status === 429) {
      return "Too many authentication attempts. Please wait and retry.";
    }
    if (error.status === 503) {
      return "Authentication backend is temporarily unavailable (missing PKCE storage).";
    }
    if (error.status === 401) {
      return "Authentication session is invalid or expired. Please sign in again.";
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "Authentication failed. Please try again.";
}

function hasNonEmptyParam(
  params: URLSearchParams,
  key: string,
): boolean {
  const value = params.get(key);
  return typeof value === "string" && value.trim().length > 0;
}

function buildCallbackParamPresence(rawParams: string): {
  appPresent: boolean;
  expiresPresent: boolean;
  spotifyPresent: boolean;
  spotifyTypePresent: boolean;
  spotifyExpiryPresent: boolean;
} {
  const normalized = rawParams.startsWith("?") || rawParams.startsWith("#")
    ? rawParams.slice(1)
    : rawParams;
  const params = new URLSearchParams(normalized);

  return {
    appPresent: hasNonEmptyParam(params, "access_token"),
    expiresPresent: hasNonEmptyParam(params, "expires_in"),
    spotifyPresent: hasNonEmptyParam(params, "spotify_access_token"),
    spotifyTypePresent: hasNonEmptyParam(params, "spotify_token_type"),
    spotifyExpiryPresent: hasNonEmptyParam(params, "spotify_expires_in"),
  };
}

function SpotifyAuthCallbackFallback() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <div
          role="status"
          aria-label="Loading Spotify authentication callback"
          className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
        >
          <span className="sr-only">Loading Spotify authentication callback</span>
        </div>
        <p className="mt-4 text-sm text-[var(--color-subtext)]">
          Preparing Spotify authentication callback...
        </p>
      </div>
    </div>
  );
}

function SpotifyAuthDebugPanel({
  debugInfo,
}: {
  debugInfo: SpotifyCallbackDebugInfo;
}) {
  const missingKeys =
    debugInfo.missingHashKeys.length > 0
      ? debugInfo.missingHashKeys.join(", ")
      : "none";

  return (
    <div className="mt-4 rounded-xl border border-[#f4b266]/35 bg-[#f4b266]/8 p-4 text-left">
      <p className="text-xs font-semibold tracking-[0.12em] text-[#f4b266] uppercase">
        OAuth Debug Panel
      </p>
      <div className="mt-2 space-y-1.5 text-xs text-[var(--color-subtext)]">
        <p>
          <span className="font-semibold text-[var(--color-text)]">Trace ID:</span>{" "}
          {debugInfo.traceId ?? "n/a"}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">/auth/me status:</span>{" "}
          {debugInfo.authMeStatus ?? "n/a"}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">
            Required hash keys present:
          </span>{" "}
          {debugInfo.missingHashKeys.length === 0
            ? "yes"
            : `no (missing: ${missingKeys})`}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">
            Authorization header sent:
          </span>{" "}
          {debugInfo.authorizationHeaderSent ? "yes" : "no"}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">/auth/me URL:</span>{" "}
          {debugInfo.authMeFinalUrl ?? debugInfo.authMeUrl}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">Redirected:</span>{" "}
          {debugInfo.authMeRedirected === null
            ? "n/a"
            : debugInfo.authMeRedirected
              ? "yes"
              : "no"}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text)]">Body snippet:</span>{" "}
          {debugInfo.authMeBodySnippet ?? "n/a"}
        </p>
        {debugInfo.traceId ? (
          <div>
            <p className="font-semibold text-[var(--color-text)]">
              Backend debug curl:
            </p>
            <code className="mt-1 block whitespace-pre-wrap break-all rounded bg-black/25 px-2 py-1 text-[11px] text-white/85">
              {`curl -H \"X-Auth-Debug-Token: <AUTH_DEBUG_TOKEN>\" \"https://www.darkfloor.one/api/auth/spotify/debug?trace_id=${encodeURIComponent(
                debugInfo.traceId,
              )}&limit=200\"`}
            </code>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpotifyAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<SpotifyCallbackDebugInfo | null>(
    null,
  );

  const nextPath = useMemo(
    () => resolveFrontendRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const queryError = searchParams.get("error");
  const queryErrorDescription = searchParams.get("error_description");
  const traceId = searchParams.get("trace");
  const authDebugEnabled = isClientAuthDebugEnabled();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const searchPresence = buildCallbackParamPresence(window.location.search);
      const hashPresence = buildCallbackParamPresence(window.location.hash);
      const appTokenPresent =
        searchPresence.appPresent || hashPresence.appPresent;
      const spotifyTokenPresent =
        searchPresence.spotifyPresent || hashPresence.spotifyPresent;

      logAuthClientDebug("callback mounted", {
        path: window.location.pathname,
        searchPresent: window.location.search.length > 0,
        hashPresent: window.location.hash.length > 0,
        nextPath,
      });
      logAuthClientDebug("search params parsed", searchPresence);
      logAuthClientDebug("hash parsed", hashPresence);
      logAuthClientDebug("access_token present", {
        anyPresent: appTokenPresent,
        searchPresent: searchPresence.appPresent,
        hashPresent: hashPresence.appPresent,
      });
      logAuthClientDebug("spotify_access_token present", {
        anyPresent: spotifyTokenPresent,
        searchPresent: searchPresence.spotifyPresent,
        hashPresent: hashPresence.spotifyPresent,
      });

      if (queryError) {
        const status = queryError === "access_denied" ? 403 : 401;
        setState("error");
        setDebugInfo({
          traceId,
          requiredHashKeys: createEmptyHashPresence(),
          missingHashKeys: [
            "access_token",
            "token_type",
            "expires_in",
          ],
          authorizationHeaderSent: false,
          authMeStatus: null,
          authMeBodySnippet: queryErrorDescription ?? queryError,
          authMeUrl: "https://www.darkfloor.one/api/auth/me",
          authMeRedirected: null,
          authMeFinalUrl: null,
        });
        setErrorMessage(
          getErrorMessage(
            new SpotifyAuthClientError(
              queryErrorDescription ?? queryError,
              status,
            ),
          ),
        );
        return;
      }

      try {
        const result = await handleSpotifyCallbackHash();
        if (cancelled) return;
        logAuthClientDebug("tokens persisted", {
          appPersisted: Boolean(result.accessToken),
          spotifyPersisted: result.spotifyAccessTokenPresent,
        });
        await bootstrapSpotifyAppSession(result.accessToken);
        if (cancelled) return;
        const nextAuthSession = await getSession();
        if (!nextAuthSession?.user) {
          throw new SpotifyAuthClientError(
            "App session bootstrap did not produce a local session",
            500,
          );
        }
        logAuthClientDebug("redirecting to next", { nextPath });
        router.replace(nextPath);
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setErrorMessage(getErrorMessage(error));
        if (error instanceof SpotifyAuthClientError) {
          setDebugInfo(error.debugInfo);
        } else {
          setDebugInfo(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [nextPath, queryError, queryErrorDescription, router, traceId]);

  if (state === "pending") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        <div className="surface-panel w-full p-8 text-center">
          <div
            role="status"
            aria-label="Authenticating with Spotify"
            className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
          >
            <span className="sr-only">Authenticating with Spotify</span>
          </div>
          <p className="mt-4 text-sm text-[var(--color-subtext)]">
            Authenticating with Spotify...
          </p>
        </div>
      </div>
    );
  }

  const signInUrl = `/signin?callbackUrl=${encodeURIComponent(nextPath)}`;
  const showDebugPanel =
    authDebugEnabled && debugInfo !== null && debugInfo.authMeStatus !== null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <p className="text-sm text-[var(--color-subtext)]">
          {errorMessage ?? "Authentication failed."}
        </p>
        {showDebugPanel ? (
          <SpotifyAuthDebugPanel debugInfo={debugInfo} />
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => startSpotifyLogin(nextPath)}
            className="w-full rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Retry Spotify Sign-In
          </button>
          <button
            type="button"
            onClick={() => router.replace(signInUrl)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SpotifyAuthCallbackPage() {
  return (
    <Suspense fallback={<SpotifyAuthCallbackFallback />}>
      <SpotifyAuthCallbackContent />
    </Suspense>
  );
}
