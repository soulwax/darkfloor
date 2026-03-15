"use client";

import {
  handleSpotifyCallbackHash,
  startSpotifyLogin,
} from "@/services/spotifyAuthClient";
import { resolveSpotifyPostAuthPath } from "@/utils/spotifyAuthRedirect";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

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

function getCallbackErrorMessage(options: {
  error: string | null;
  errorDescription: string | null;
  fallbackMessage: string;
  deniedMessage: string;
  genericMessage: string;
}): string {
  if (options.error === "access_denied") {
    return options.deniedMessage;
  }

  if (options.errorDescription && options.errorDescription.trim().length > 0) {
    return options.errorDescription;
  }

  if (options.error && options.error.trim().length > 0) {
    return options.error;
  }

  if (options.fallbackMessage.trim().length > 0) {
    return options.fallbackMessage;
  }

  return options.genericMessage;
}

function SpotifyAuthCallbackContent() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/library";
    return resolveSpotifyPostAuthPath(
      searchParams.get("next"),
      window.location.origin,
    );
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    void handleSpotifyCallbackHash()
      .then(() => {
        if (cancelled) return;
        router.replace(nextPath);
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setErrorMessage(
          getCallbackErrorMessage({
            error: searchParams.get("error"),
            errorDescription: searchParams.get("error_description"),
            fallbackMessage:
              error instanceof Error
                ? error.message
                : t("spotifyConnectionFailed"),
            deniedMessage: t("spotifyDenied"),
            genericMessage: t("spotifyConnectionFailed"),
          }),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, searchParams, t]);

  if (!errorMessage) {
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

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <p className="text-sm text-[var(--color-subtext)]">{errorMessage}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => startSpotifyLogin(nextPath)}
            className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {tc("retry")}
          </button>
          <button
            type="button"
            onClick={() => router.replace(nextPath)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
          >
            {tc("continueToApp")}
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
