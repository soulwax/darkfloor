// File: apps/web/src/hooks/useMediaQuery.ts

"use client";

import { useSyncExternalStore } from "react";

const MEDIA_QUERY_DEFAULT_MATCH = false;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia(query);
      const handleChange = () => {
        onStoreChange();
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      } else {
        mediaQuery.addListener(handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        } else {
          mediaQuery.removeListener(handleChange);
        }
      };
    },
    () => {
      if (typeof window === "undefined") {
        return MEDIA_QUERY_DEFAULT_MATCH;
      }

      return window.matchMedia(query).matches;
    },
    () => MEDIA_QUERY_DEFAULT_MATCH,
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 769px) and (max-width: 1024px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1025px)");
}

export function useIsMobileOrTablet(): boolean {
  return useMediaQuery("(max-width: 1024px)");
}

export function useIsLandscape(): boolean {
  return useMediaQuery("(orientation: landscape)");
}

export function useIsPortrait(): boolean {
  return useMediaQuery("(orientation: portrait)");
}

export function useBreakpoint(): "mobile" | "tablet" | "desktop" {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}
