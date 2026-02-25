// File: apps/web/src/components/AuthGate.tsx

"use client";

import { GuestModal } from "@/components/GuestModal";
import {
  GuestModalProvider,
  type GuestModalContextValue,
} from "@/contexts/GuestModalContext";
import {
  SPOTIFY_AUTH_STATE_EVENT,
  buildSpotifyFrontendCallbackUrl,
  getInMemoryAccessToken,
  hasSpotifyTokenHashFragment,
  resolveFrontendRedirectPath,
  restoreSpotifySession,
  type SpotifyAuthStateEventDetail,
} from "@/services/spotifyAuthClient";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const BYPASS_PATH_PREFIXES = ["/auth/spotify/callback", "/auth/callback"];
const GUEST_MODAL_DISMISSED_STORAGE_KEY = "sb_guest_modal_dismissed";
const LEGACY_GUEST_MODE_STORAGE_KEY = "sb_guest_mode_enabled";

function getSessionStatus(
  sessionResult: unknown,
): "loading" | "authenticated" | "unauthenticated" {
  if (!sessionResult || typeof sessionResult !== "object") {
    return "unauthenticated";
  }

  const status = (sessionResult as Record<string, unknown>).status;
  if (status === "loading") return "loading";
  if (status === "authenticated") return "authenticated";
  return "unauthenticated";
}

function getSessionUser(sessionResult: unknown): unknown {
  if (!sessionResult || typeof sessionResult !== "object") return null;

  const data = (sessionResult as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;

  return (data as Record<string, unknown>).user ?? null;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sessionResult = useSession() as unknown;
  const [spotifyAuthenticated, setSpotifyAuthenticated] = useState(false);
  const [spotifyResolved, setSpotifyResolved] = useState(false);
  const [manualGuestModalOpen, setManualGuestModalOpen] = useState(false);
  const [guestModalDismissed, setGuestModalDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem(GUEST_MODAL_DISMISSED_STORAGE_KEY) === "true" ||
      window.localStorage.getItem(LEGACY_GUEST_MODE_STORAGE_KEY) === "true"
    );
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isBypassPath = BYPASS_PATH_PREFIXES.some((prefix) =>
      window.location.pathname.startsWith(prefix),
    );
    const hasAuthHash = hasSpotifyTokenHashFragment(window.location.hash);
    if (!isBypassPath && hasAuthHash) {
      const nextFromQuery = new URLSearchParams(window.location.search).get(
        "next",
      );
      const fallbackNextPath =
        nextFromQuery && nextFromQuery.trim().length > 0
          ? resolveFrontendRedirectPath(nextFromQuery)
          : window.location.pathname === "/"
            ? "/library"
            : resolveFrontendRedirectPath(
                `${window.location.pathname}${window.location.search}`,
              );
      const callbackUrl = new URL(
        buildSpotifyFrontendCallbackUrl(fallbackNextPath),
      );
      callbackUrl.hash = window.location.hash;
      window.location.replace(callbackUrl.toString());
      return;
    }

    let cancelled = false;

    const syncSpotifySession = async () => {
      const restored = await restoreSpotifySession();
      if (cancelled) return;
      setSpotifyAuthenticated(restored);
      setSpotifyResolved(true);
    };

    const onSpotifyState = (event: Event) => {
      const detail = (event as CustomEvent<SpotifyAuthStateEventDetail>).detail;
      setSpotifyAuthenticated(Boolean(detail?.authenticated));
      setSpotifyResolved(true);
    };

    window.addEventListener(
      SPOTIFY_AUTH_STATE_EVENT,
      onSpotifyState as EventListener,
    );
    void syncSpotifySession();

    return () => {
      cancelled = true;
      window.removeEventListener(
        SPOTIFY_AUTH_STATE_EVENT,
        onSpotifyState as EventListener,
      );
    };
  }, []);

  const bypassGate = useMemo(
    () => BYPASS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname],
  );

  const sessionUser = getSessionUser(sessionResult);
  const status = getSessionStatus(sessionResult);
  const hasInMemorySpotifyAccessToken = Boolean(getInMemoryAccessToken());
  const isAuthenticated =
    Boolean(sessionUser) || spotifyAuthenticated || hasInMemorySpotifyAccessToken;
  const isLoading =
    status === "loading" ||
    (!sessionUser && !spotifyResolved && !hasInMemorySpotifyAccessToken);

  const openGuestModal = useCallback(() => {
    setManualGuestModalOpen(true);
  }, []);

  const dismissGuestModal = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_MODAL_DISMISSED_STORAGE_KEY, "true");
      window.localStorage.setItem(LEGACY_GUEST_MODE_STORAGE_KEY, "true");
    }
    setGuestModalDismissed(true);
    setManualGuestModalOpen(false);
  }, []);

  const showGuestModalFromGate =
    !bypassGate &&
    !isLoading &&
    !isAuthenticated &&
    !guestModalDismissed &&
    pathname === "/";
  const showGuestModal = showGuestModalFromGate || manualGuestModalOpen;

  const guestModalContextValue = useMemo<GuestModalContextValue>(
    () => ({
      isGuestModalOpen: showGuestModal,
      openGuestModal,
    }),
    [showGuestModal, openGuestModal],
  );

  return (
    <GuestModalProvider value={guestModalContextValue}>
      {children}
      {showGuestModal ? (
        <GuestModal onContinueAsGuest={dismissGuestModal} />
      ) : null}
    </GuestModalProvider>
  );
}
