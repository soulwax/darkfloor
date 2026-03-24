// File: apps/web/src/components/Header.tsx

"use client";

import { SearchSuggestionsList } from "@/components/SearchSuggestionsList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuDivider,
  DropdownMenuItem,
  DropdownMenuLabelText,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGuestModal } from "@/contexts/GuestModalContext";
import { useCompactModePreference } from "@/hooks/useCompactModePreference";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { normalizeHealthStatus } from "@/utils/healthStatus";
import { api } from "@starchild/api-client/trpc/react";
import type { SearchSuggestionItem } from "@starchild/types/searchSuggestions";
import {
  BarChart3,
  Home,
  Library,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Music2,
  Search,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const tc = useTranslations("common");
  const th = useTranslations("header");
  const ts = useTranslations("search");
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
  const { compactMode, toggleCompactMode } = useCompactModePreference();

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

  const primaryActionClass =
    "shell-action h-9 px-3 text-xs font-semibold aria-[current=page]:border-[rgba(244,178,102,0.24)] aria-[current=page]:bg-[rgba(244,178,102,0.12)] aria-[current=page]:text-[var(--color-text)]";
  const iconActionClass = "shell-icon-action h-9 w-9";

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
      <div
        className={`theme-chrome-header electron-header-main relative z-10 grid items-center border ${
          compactMode
            ? "grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-[1rem] py-1.5"
            : "grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[1.15rem] py-2"
        }`}
      >
        <div className="electron-no-drag relative flex items-center gap-2 px-2 sm:px-3">
          <div className="relative min-w-0 flex-1">
            <form
              className={`electron-header-search flex w-full items-center gap-2 rounded-full border px-3 ${
                compactMode ? "h-10" : "h-11"
              }`}
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
                placeholder={ts("placeholder")}
                aria-label={ts("ariaLabel")}
                autoComplete="off"
              />
              <button
                type="submit"
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[rgba(244,178,102,0.16)] px-2.5 text-xs leading-none font-semibold text-[var(--color-text)] transition-colors hover:bg-[rgba(244,178,102,0.22)]"
              >
                <Search className="h-3.5 w-3.5" />
                <span className={compactMode ? "hidden" : "hidden lg:inline"}>
                  {tc("search")}
                </span>
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
        </div>

        <div className="electron-no-drag flex min-w-0 items-center justify-end gap-2 pr-2 sm:pr-3">
          <Link
            href="/"
            className={primaryActionClass}
            aria-current={isHomeActive ? "page" : undefined}
          >
            <Home className="h-3.5 w-3.5" />
            <span className={compactMode ? "hidden" : "hidden xl:inline"}>
              {tc("home")}
            </span>
          </Link>
          <Link
            href="/library"
            className={primaryActionClass}
            aria-current={isLibraryActive ? "page" : undefined}
          >
            <Library className="h-3.5 w-3.5" />
            <span className={compactMode ? "hidden" : "hidden xl:inline"}>
              {tc("library")}
            </span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={iconActionClass}
                aria-label={th("openMenu")}
                title={th("openMenu")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabelText>{th("openMenu")}</DropdownMenuLabelText>
              <DropdownMenuItem onSelect={toggleCompactMode} className="gap-2">
                {compactMode ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
                <span>
                  {compactMode ? th("switchExpanded") : th("switchCompact")}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (!isGuestModalOpen) {
                    openGuestModal();
                  }
                }}
                disabled={isGuestModalOpen}
                className="gap-2"
              >
                <Music2 className="h-4 w-4" />
                <span>{th("greeter")}</span>
              </DropdownMenuItem>
              {!isElectronRuntime && (
                <DropdownMenuItem
                  onSelect={() =>
                    window.open(
                      "https://analyze.darkfloor.org",
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>{th("analyse")}</span>
                </DropdownMenuItem>
              )}
              {apiHealthy !== null && (
                <>
                  <DropdownMenuDivider />
                  <DropdownMenuItem disabled className="gap-2 opacity-100">
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
                        ? th("apiHealthy")
                        : apiHealthy === "degraded"
                          ? th("apiDegraded")
                          : th("apiDown")}
                    </span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
