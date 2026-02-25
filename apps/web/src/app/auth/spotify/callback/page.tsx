// File: apps/web/src/app/auth/spotify/callback/page.tsx

"use client";

import {
  SpotifyAuthClientError,
  type SpotifyCallbackDebugInfo,
  handleSpotifyCallbackHash,
  resolveFrontendRedirectPath,
  startSpotifyLogin,
} from "@/services/spotifyAuthClient";
import { isClientAuthDebugEnabled } from "@/utils/authDebugClient";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type CallbackState = "pending" | "error";

function createEmptyHashPresence(): SpotifyCallbackDebugInfo["requiredHashKeys"] {
  return {
    access_token: false,
    token_type: false,
    expires_in: false,
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
        await handleSpotifyCallbackHash();
        if (cancelled) return;
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
