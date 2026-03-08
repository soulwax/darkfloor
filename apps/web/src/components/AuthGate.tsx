// File: apps/web/src/components/AuthGate.tsx

"use client";

import { GuestModal } from "@/components/GuestModal";
import {
  GuestModalProvider,
  type GuestModalContextValue,
} from "@/contexts/GuestModalContext";
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

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [manualGuestModalOpen, setManualGuestModalOpen] = useState(false);
  const [guestModalDismissed, setGuestModalDismissed] = useState(false);

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

  const bypassGate = useMemo(
    () => BYPASS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname],
  );

  const isAuthenticated = Boolean(session?.user);
  const isLoading = status === "loading";

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
