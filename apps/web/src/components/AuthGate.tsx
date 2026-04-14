// File: apps/web/src/components/AuthGate.tsx

"use client";

import { GuestModal } from "@/components/GuestModal";
import {
  GuestModalProvider,
  type GuestModalContextValue,
} from "@/contexts/GuestModalContext";
import { useSession } from "next-auth/react";
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
const BROWSER_NAVIGATION_EVENT = "starchild:browser-navigation";

export function AuthGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [manualGuestModalOpen, setManualGuestModalOpen] = useState(false);
  const [guestModalDismissed, setGuestModalDismissed] = useState(false);
  const [pathname, setPathname] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only dismissal state after mount to keep SSR and client markup aligned. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    setGuestModalDismissed(
      window.localStorage.getItem(GUEST_MODAL_DISMISSED_STORAGE_KEY) ===
        "true" ||
        window.localStorage.getItem(LEGACY_GUEST_MODE_STORAGE_KEY) === "true",
    );
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updatePathname = () => {
      setPathname(window.location.pathname);
    };

    updatePathname();

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(
      window.history,
    );

    const dispatchNavigationEvent = () => {
      window.dispatchEvent(new Event(BROWSER_NAVIGATION_EVENT));
    };

    window.history.pushState = function pushState(...args) {
      originalPushState(...args);
      dispatchNavigationEvent();
    };

    window.history.replaceState = function replaceState(...args) {
      originalReplaceState(...args);
      dispatchNavigationEvent();
    };

    window.addEventListener("popstate", dispatchNavigationEvent);
    window.addEventListener(BROWSER_NAVIGATION_EVENT, updatePathname);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", dispatchNavigationEvent);
      window.removeEventListener(BROWSER_NAVIGATION_EVENT, updatePathname);
    };
  }, []);

  const bypassGate = useMemo(
    () => BYPASS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname],
  );

  const isAuthenticated = Boolean(session?.user);
  const isLoading = status === "loading";

  const openGuestModal = useCallback(() => {
    setManualGuestModalOpen(true);
  }, []);

  const closeGuestModal = useCallback(() => {
    setManualGuestModalOpen(false);
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
  const handleGuestModalClose = showGuestModalFromGate
    ? dismissGuestModal
    : closeGuestModal;

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
        <GuestModal onContinueAsGuest={handleGuestModalClose} />
      ) : null}
    </GuestModalProvider>
  );
}
