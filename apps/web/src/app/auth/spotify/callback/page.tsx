"use client";

import { resolvePostAuthPath } from "@/utils/authRedirect";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function SpotifyAuthCallbackFallback() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <div
          role="status"
          aria-label={t("spotifyCallbackLoading")}
          className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
        >
          <span className="sr-only">{t("spotifyCallbackLoading")}</span>
        </div>
        <p className="mt-4 text-sm text-[var(--color-subtext)]">
          {t("spotifyCallbackPreparing")}
        </p>
      </div>
    </div>
  );
}

function getLegacyCallbackMessage(
  error: string | null,
  errorDescription: string | null,
  deniedMessage: string,
  defaultMessage: string,
): string {
  if (error === "access_denied") {
    return deniedMessage;
  }

  if (errorDescription && errorDescription.trim().length > 0) {
    return errorDescription;
  }

  if (error && error.trim().length > 0) {
    return error;
  }

  return defaultMessage;
}

function SpotifyAuthCallbackContent() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

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
        t("spotifyDenied"),
        t("spotifyOAuthRemoved"),
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
            onClick={() => router.replace(signInUrl)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
          >
            {tc("continueToSignIn")}
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
