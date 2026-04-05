"use client";

import {
  getEnabledOAuthUiProviders,
  getOAuthProviderButtonStyle,
  type SupportedOAuthProviderId,
} from "@/config/oauthProviders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logAuthClientDebug } from "@/utils/authDebugClient";
import { OAUTH_PROVIDERS_FALLBACK } from "@/utils/authProvidersFallback";
import {
  prefetchOAuthCsrfToken,
  startOAuthSignIn,
} from "@/utils/startOAuthSignIn";
import { getProviders } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

type ProvidersResponse = Awaited<ReturnType<typeof getProviders>>;

interface AuthModalProps {
  isOpen: boolean;
  callbackUrl: string;
  title?: string;
  message?: string;
  onClose: () => void;
}

const SIGN_IN_PENDING_TIMEOUT_MS = 15_000;

export function AuthModal({
  isOpen,
  callbackUrl,
  title,
  message,
  onClose,
}: AuthModalProps) {
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [providers, setProviders] = useState<ProvidersResponse>(null);
  const [prefetchedCsrfToken, setPrefetchedCsrfToken] = useState<string | null>(
    null,
  );
  const [submittingProviderId, setSubmittingProviderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let resolved = false;
    logAuthClientDebug("AuthModal opened; fetching OAuth providers", {
      callbackUrl,
    });

    const timeoutId = setTimeout(() => {
      if (cancelled || resolved) return;
      console.warn(
        "[AuthModal] getProviders timed out; using fallback OAuth providers.",
      );
      logAuthClientDebug(
        "AuthModal getProviders timed out; using fallback list",
        {
          fallbackProviders: Object.keys(OAUTH_PROVIDERS_FALLBACK),
        },
      );
      setProviders(OAUTH_PROVIDERS_FALLBACK);
    }, 3000);

    void getProviders()
      .then((result) => {
        if (cancelled) return;
        resolved = true;
        clearTimeout(timeoutId);
        const resolvedProviders = result ?? OAUTH_PROVIDERS_FALLBACK;
        logAuthClientDebug("AuthModal providers fetched", {
          providerIds: Object.keys(resolvedProviders),
          usedFallback: !result,
        });
        setProviders(resolvedProviders);
      })
      .catch((providerError: unknown) => {
        if (cancelled) return;
        resolved = true;
        clearTimeout(timeoutId);
        logAuthClientDebug("AuthModal getProviders failed; using fallback", {
          fallbackProviders: Object.keys(OAUTH_PROVIDERS_FALLBACK),
          error:
            providerError instanceof Error
              ? providerError.message
              : String(providerError),
        });
        setProviders(OAUTH_PROVIDERS_FALLBACK);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [callbackUrl, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    void prefetchOAuthCsrfToken()
      .then((csrfToken) => {
        if (cancelled) return;
        setPrefetchedCsrfToken(csrfToken);
        logAuthClientDebug("AuthModal prefetched CSRF token", {
          callbackUrl,
          tokenLength: csrfToken.length,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPrefetchedCsrfToken(null);
        logAuthClientDebug("AuthModal failed to prefetch CSRF token", {
          callbackUrl,
          error,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, isOpen]);

  const oauthProviders = useMemo(() => {
    return getEnabledOAuthUiProviders(providers);
  }, [providers]);
  const submittingProvider = useMemo(
    () =>
      oauthProviders.find((provider) => provider.id === submittingProviderId) ??
      null,
    [oauthProviders, submittingProviderId],
  );

  useEffect(() => {
    if (!isOpen || !providers) return;
    logAuthClientDebug("AuthModal providers available", {
      providerIds: oauthProviders.map((provider) => provider.id),
      callbackUrl,
    });
  }, [callbackUrl, isOpen, oauthProviders, providers]);

  useEffect(() => {
    if (!submittingProviderId) return;
    const timeoutId = window.setTimeout(() => {
      setSubmittingProviderId(null);
    }, SIGN_IN_PENDING_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [submittingProviderId]);

  const handleProviderSignIn = async (providerId: SupportedOAuthProviderId) => {
    setSubmittingProviderId(providerId);

    logAuthClientDebug("AuthModal starting OAuth sign-in", {
      providerId,
      callbackUrl,
    });

    try {
      await startOAuthSignIn(providerId, callbackUrl, prefetchedCsrfToken);
      logAuthClientDebug("AuthModal signIn call resolved", { providerId });
    } catch (error: unknown) {
      logAuthClientDebug("AuthModal signIn call failed", { providerId, error });
      setPrefetchedCsrfToken(null);
      setSubmittingProviderId(null);
      throw error;
    }
  };

  const resolvedTitle = title ?? ta("signInToContinue");
  const resolvedMessage = message ?? ta("chooseProviderToContinue");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && submittingProviderId === null) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm p-0">
        <div className="p-6">
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle>{resolvedTitle}</DialogTitle>
            <DialogDescription>{resolvedMessage}</DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            {providers === null && oauthProviders.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <div
                  role="status"
                  aria-label={ta("loadingSignInProviders")}
                  className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"
                >
                  <span className="sr-only">
                    {ta("loadingSignInProviders")}
                  </span>
                </div>
              </div>
            ) : oauthProviders.length > 0 ? (
              oauthProviders.map((provider) => {
                const providerClasses = getOAuthProviderButtonStyle(
                  provider.id,
                );
                const isSubmitting = submittingProviderId === provider.id;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => void handleProviderSignIn(provider.id)}
                    disabled={submittingProviderId !== null}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${providerClasses}`}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <div
                          role="status"
                          aria-label={ta("authenticatingWith", {
                            provider: provider.name,
                          })}
                          className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.82)] border-r-transparent border-b-transparent"
                        >
                          <span className="sr-only">
                            {ta("authenticatingWith", {
                              provider: provider.name,
                            })}
                          </span>
                        </div>
                      ) : null}
                      <span>
                        {ta("continueWith", { provider: provider.name })}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-xl border border-[color:var(--shell-border)] bg-[color:var(--shell-muted-bg)] px-4 py-3 text-center text-sm text-[var(--color-subtext)]">
                {ta("noProvidersAvailable")}
              </p>
            )}
          </div>

          {submittingProvider ? (
            <p className="mt-3 text-center text-xs text-[var(--color-subtext)]">
              {ta("authenticatingWith", {
                provider: submittingProvider.name,
              })}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            disabled={submittingProviderId !== null}
            className="btn-secondary mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            {tc("cancel")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
