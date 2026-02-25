// File: apps/web/src/contexts/AuthModalContext.tsx

"use client";

import { AuthModal } from "@/components/AuthModal";
import {
  AUTH_REQUIRED_EVENT,
  type AuthRequiredEventDetail,
} from "@/services/spotifyAuthClient";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface OpenAuthModalOptions {
  callbackUrl?: string;
  title?: string;
  message?: string;
}

interface AuthModalContextType {
  isOpen: boolean;
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
}

const DEFAULT_TITLE = "Sign in to continue";
const DEFAULT_MESSAGE = "Choose an OAuth provider to continue.";

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined,
);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const fallbackCallbackUrl = useMemo(() => pathname || "/", [pathname]);

  const openAuthModal = useCallback(
    (options?: OpenAuthModalOptions) => {
      const currentUrl =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : fallbackCallbackUrl;

      setCallbackUrl(options?.callbackUrl ?? currentUrl);
      setTitle(options?.title ?? DEFAULT_TITLE);
      setMessage(options?.message ?? DEFAULT_MESSAGE);
      setIsOpen(true);
    },
    [fallbackCallbackUrl],
  );

  const closeAuthModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<AuthRequiredEventDetail>).detail;
      openAuthModal({
        callbackUrl: detail?.callbackUrl ?? fallbackCallbackUrl,
        title: "Sign in to continue",
        message: "Your Spotify session expired. Sign in again to continue.",
      });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired as EventListener);
    return () => {
      window.removeEventListener(
        AUTH_REQUIRED_EVENT,
        onAuthRequired as EventListener,
      );
    };
  }, [fallbackCallbackUrl, openAuthModal]);

  const value = useMemo<AuthModalContextType>(
    () => ({
      isOpen,
      openAuthModal,
      closeAuthModal,
    }),
    [isOpen, openAuthModal, closeAuthModal],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isOpen}
        callbackUrl={callbackUrl}
        title={title}
        message={message}
        onClose={closeAuthModal}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return context;
}
