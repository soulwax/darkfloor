// File: apps/web/src/components/Header.tsx

"use client";

import { SearchSuggestionsList } from "@/components/SearchSuggestionsList";
import { useGuestModal } from "@/contexts/GuestModalContext";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@starchild/api-client/trpc/react";
import type { SearchSuggestionItem } from "@starchild/types/searchSuggestions";
import { normalizeHealthStatus } from "@/utils/healthStatus";
import { Home, Library, Music2, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const { isGuestModalOpen, openGuestModal } = useGuestModal();
  const [apiHealthy, setApiHealthy] = useState<
    "healthy" | "degraded" | "down" | null
  >(null);
  const [searchText, setSearchText] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const isLinuxElectron =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";
  const lastHealthErrorLogRef = useRef(0);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopHeaderRef = useRef<HTMLElement>(null);
  const searchBlurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const healthUrls = ["/api/v2/status", "/api/v2/health"];

    let isMounted = true;

    const checkHealth = async () => {
      let lastFailure:
        | {
            url: string;
            status?: number;
            parsedStatus?: string | null;
            rawText?: string;
            message?: string;
          }
        | undefined;

      for (const healthUrl of healthUrls) {
        try {
          const response = await fetch(healthUrl, {
            cache: "no-store",
          });

          if (!isMounted) return;

          let rawText = "";
          try {
            rawText = await response.text();
          } catch (error) {
            console.warn("[Header] Health response read failed:", error);
          }
          let payload: unknown = null;
          if (rawText) {
            try {
              payload = JSON.parse(rawText) as unknown;
            } catch {
              payload = null;
            }
          }
          const parsedStatus = normalizeHealthStatus(payload, rawText);

          if (!response.ok && parsedStatus === null) {
            lastFailure = {
              url: healthUrl,
              status: response.status,
              parsedStatus,
              rawText,
            };
            continue;
          }

          const effectiveStatus =
            parsedStatus ?? (response.ok ? "ok" : "unhealthy");

          let overallStatus: "healthy" | "degraded" | "down";
          if (effectiveStatus === "ok") {
            overallStatus = "healthy";
          } else if (effectiveStatus === "degraded") {
            overallStatus = "degraded";
          } else {
            overallStatus = "down";
          }

          if (overallStatus !== "healthy") {
            console.warn("[Header] API V2 health degraded:", {
              url: healthUrl,
              status: response.status,
              parsedStatus: effectiveStatus,
              raw: rawText,
              overallStatus,
            });
          }

          setApiHealthy(overallStatus);
          return;
        } catch (error) {
          lastFailure = {
            url: healthUrl,
            message: error instanceof Error ? error.message : String(error),
          };
        }
      }

      if (!isMounted) return;

      const now = Date.now();
      if (now - lastHealthErrorLogRef.current > 60_000) {
        lastHealthErrorLogRef.current = now;
        console.warn("[Header] API health check failed:", {
          checkedUrls: healthUrls,
          failure: lastFailure,
        });
      }

      setApiHealthy("down");
    };

    void checkHealth();

    const interval = setInterval(() => {
      if (isMounted) {
        void checkHealth();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.removeProperty("--electron-header-height");
      return;
    }

    const updateHeaderHeight = () => {
      const headerHeight = Math.max(
        0,
        Math.round(
          desktopHeaderRef.current?.getBoundingClientRect().height ?? 0,
        ),
      );
      document.documentElement.style.setProperty(
        "--electron-header-height",
        `${headerHeight}px`,
      );
    };

    const headerElement = desktopHeaderRef.current;
    const resizeObserver =
      headerElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateHeaderHeight())
        : null;

    updateHeaderHeight();
    if (headerElement) {
      resizeObserver?.observe(headerElement);
    }
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
      resizeObserver?.disconnect();
      document.documentElement.style.removeProperty("--electron-header-height");
    };
  }, [isMobile]);

  const headerSearchQuery = searchParams.get("q") ?? "";
  const isHomeActive = pathname === "/";
  const isLibraryActive = pathname.startsWith("/library");

  const { data: recentSearches = [] } = api.music.getRecentSearches.useQuery(
    { limit: 12 },
    { enabled: !!session },
  );

  const { suggestions } = useSearchSuggestions(searchText, recentSearches, {
    enabled: isSearchFocused,
    limit: 10,
  });

  const submitHeaderSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) {
      router.push("/", { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set("q", query);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchText(headerSearchQuery);
    setActiveSuggestionIndex(-1);
  }, [headerSearchQuery]);

  useEffect(() => {
    return () => {
      if (searchBlurTimerRef.current !== null) {
        window.clearTimeout(searchBlurTimerRef.current);
      }
    };
  }, []);

  const showSuggestions =
    isSearchFocused && searchText.trim().length > 0 && suggestions.length > 0;

  const selectSuggestion = (suggestion: SearchSuggestionItem) => {
    setSearchText(suggestion.query);
    setIsSearchFocused(false);
    setActiveSuggestionIndex(-1);
    submitHeaderSearch(suggestion.query);
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!showSuggestions) {
      if (event.key === "Escape") {
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
      if (suggestion) {
        selectSuggestion(suggestion);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const isElectronRuntime =
    typeof window !== "undefined" && Boolean(window.electron?.isElectron);

  if (isMobile && isElectronRuntime) {
    return null;
  }

  return (
    <header
      ref={desktopHeaderRef}
      className="electron-app-header fixed right-0 z-30 hidden px-2 pb-1 md:block"
      style={{
        top: isLinuxElectron ? "36px" : "0",
        paddingTop: "0.5rem",
        left: "var(--electron-sidebar-width, 0px)",
        right: "var(--desktop-right-rail-width, 0px)",
      }}
      suppressHydrationWarning
    >
      <div className="theme-chrome-header electron-header-main relative z-10 grid grid-cols-[minmax(0,1fr)_minmax(210px,auto)] items-center gap-3 rounded-[1.25rem] border py-2 backdrop-blur-xl">
        <div className="electron-no-drag relative flex items-center justify-center">
          <form
            className="electron-header-search flex h-11 w-[90%] items-center gap-2.5 rounded-full border px-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitHeaderSearch(searchText);
              setIsSearchFocused(false);
              setActiveSuggestionIndex(-1);
            }}
          >
            <Search className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
            <input
              ref={headerSearchInputRef}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => {
                if (searchBlurTimerRef.current !== null) {
                  window.clearTimeout(searchBlurTimerRef.current);
                  searchBlurTimerRef.current = null;
                }
                setIsSearchFocused(true);
              }}
              onBlur={() => {
                searchBlurTimerRef.current = window.setTimeout(() => {
                  setIsSearchFocused(false);
                  setActiveSuggestionIndex(-1);
                }, 120);
              }}
              onKeyDown={handleSearchKeyDown}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm leading-none text-[var(--color-text)] placeholder-[var(--color-muted)] outline-none"
              placeholder="Search for songs, artists, or albums..."
              aria-label="Search music"
              autoComplete="off"
            />
            <button
              type="submit"
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] px-3 text-xs leading-none font-bold text-[var(--color-on-accent)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search</span>
            </button>
          </form>
          {showSuggestions && (
            <SearchSuggestionsList
              suggestions={suggestions}
              activeIndex={activeSuggestionIndex}
              onActiveIndexChange={setActiveSuggestionIndex}
              onSelect={selectSuggestion}
              className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-40"
            />
          )}
        </div>

        <div className="electron-no-drag flex min-w-0 items-center justify-end gap-2">
          <Link
            href="/"
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              isHomeActive
                ? "border-[rgba(244,178,102,0.4)] bg-[rgba(244,178,102,0.18)] text-[var(--color-text)]"
                : "border-[rgba(255,255,255,0.12)] text-[var(--color-subtext)] hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--color-text)]"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Home</span>
          </Link>
          <Link
            href="/library"
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              isLibraryActive
                ? "border-[rgba(244,178,102,0.4)] bg-[rgba(244,178,102,0.18)] text-[var(--color-text)]"
                : "border-[rgba(255,255,255,0.12)] text-[var(--color-subtext)] hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--color-text)]"
            }`}
          >
            <Library className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Library</span>
          </Link>
          <button
            type="button"
            onClick={openGuestModal}
            aria-label="Reopen greeter modal"
            disabled={isGuestModalOpen}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              isGuestModalOpen
                ? "border-[rgba(29,185,84,0.45)] bg-[rgba(29,185,84,0.18)] text-[var(--color-text)]"
                : "border-[rgba(255,255,255,0.12)] text-[var(--color-subtext)] hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--color-text)]"
            } disabled:cursor-default`}
          >
            <Music2 className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Greeter</span>
          </button>
          {apiHealthy !== null && (
            <div
              className="api-health-pill hidden items-center gap-1 rounded-full border border-[rgba(255,255,255,0.1)] px-2 py-0.5 text-xs text-[var(--color-subtext)] 2xl:flex"
              aria-label="API health status"
              title="API V2 health status"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  apiHealthy === "healthy"
                    ? "bg-emerald-400"
                    : apiHealthy === "degraded"
                      ? "bg-yellow-400"
                      : "bg-rose-400"
                }`}
              />
              <span>
                {apiHealthy === "healthy"
                  ? "API Healthy"
                  : apiHealthy === "degraded"
                    ? "API Degraded"
                    : "API Down"}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
