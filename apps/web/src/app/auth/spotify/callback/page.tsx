"use client";

import { buildAuthCallbackUrl, resolvePostAuthPath } from "@/utils/authRedirect";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useMemo, useState } from "react";

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

function getLegacyCallbackMessage(
  error: string | null,
  errorDescription: string | null,
): string {
  if (error === "access_denied") {
    return "Spotify authorization was denied. Retry sign-in if you still want to connect Spotify.";
  }

  if (errorDescription && errorDescription.trim().length > 0) {
    return errorDescription;
  }

  if (error && error.trim().length > 0) {
    return error;
  }

  return "Spotify sign-in is now handled through the standard Auth.js callback flow. This legacy callback page is no longer used for normal authentication.";
}

function SpotifyAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRetrying, setIsRetrying] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/library";
    const resolved = resolvePostAuthPath(
      searchParams.get("next") ?? "/library",
      window.location.origin,
    );
    return resolved === "/" ? "/library" : resolved;
  }, [searchParams]);

  const errorMessage = useMemo(
    () =>
      getLegacyCallbackMessage(
        searchParams.get("error"),
        searchParams.get("error_description"),
      ),
    [searchParams],
  );

  const signInUrl = `/signin?callbackUrl=${encodeURIComponent(nextPath)}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <p className="text-sm text-[var(--color-subtext)]">{errorMessage}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              setIsRetrying(true);
              try {
                await signIn("spotify", {
                  callbackUrl: buildAuthCallbackUrl(nextPath, "spotify"),
                });
              } finally {
                setIsRetrying(false);
              }
            }}
            disabled={isRetrying}
            className="w-full rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isRetrying ? "Retrying..." : "Retry Spotify Sign-In"}
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
