// File: apps/web/src/app/auth/callback/page.tsx

"use client";

import {
  getOAuthProviderDisplayName,
  isEnabledOAuthProviderId,
} from "@/config/oauthProviders";
import { resolvePostAuthPath } from "@/utils/authRedirect";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const AUTH_CALLBACK_TIMEOUT_MS = 20_000;
const OAUTH_PROVIDER_FALLBACK_NAMES: Record<string, string> = {
  discord: "Discord",
  spotify: "Spotify",
};

function AuthCallbackFallback() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        <div className="flex flex-col items-center justify-center">
          <div
            role="status"
            aria-label="Loading authentication callback"
            className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
          >
            <span className="sr-only">Loading authentication callback</span>
          </div>
          <p className="mt-4 text-sm text-[var(--color-subtext)]">
            Preparing authentication callback...
          </p>
        </div>
      </div>
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [timedOut, setTimedOut] = useState(false);

  const providerName = useMemo(() => {
    const providerId = searchParams.get("provider");
    if (!providerId) return "your provider";
    if (isEnabledOAuthProviderId(providerId)) {
      return getOAuthProviderDisplayName(providerId);
    }
    return OAUTH_PROVIDER_FALLBACK_NAMES[providerId] ?? providerId;
  }, [searchParams]);

  const targetPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return resolvePostAuthPath(searchParams.get("next"), window.location.origin);
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTimedOut(true);
    }, AUTH_CALLBACK_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (timedOut) return;
    if (status !== "authenticated") return;
    router.replace(targetPath);
  }, [router, status, targetPath, timedOut]);

  const subtitle = timedOut
    ? "Authentication is taking longer than expected."
    : status === "authenticated"
      ? "Session established. Redirecting..."
      : `Authenticating with ${providerName}...`;

  const fallbackSignInUrl = `/signin?callbackUrl=${encodeURIComponent(targetPath)}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <div className="surface-panel w-full p-8 text-center">
        {!timedOut ? (
          <div className="flex flex-col items-center justify-center">
            <div
              role="status"
              aria-label={`Authenticating with ${providerName}`}
              className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
            >
              <span className="sr-only">Authenticating with {providerName}</span>
            </div>
            <p className="mt-4 text-sm text-[var(--color-subtext)]">
              {subtitle}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--color-subtext)]">{subtitle}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.replace(fallbackSignInUrl)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
              >
                Back to Sign In
              </button>
              <button
                type="button"
                onClick={() => router.replace(targetPath)}
                className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Continue to App
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
