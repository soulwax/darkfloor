"use client";

import { SearchSuggestionsList } from "@/components/SearchSuggestionsList";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { api } from "@starchild/api-client/trpc/react";
import type { SearchSuggestionItem } from "@starchild/types/searchSuggestions";
import { Maximize2, Minimize2, Minus, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type TauriWindowState = {
  isMaximized: boolean;
};

const isTauriWindowState = (value: unknown): value is TauriWindowState => {
  if (!value || typeof value !== "object") return false;
  const payload = value as { isMaximized?: unknown };
  return typeof payload.isMaximized === "boolean";
};

const shouldSkipWindowDrag = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-no-window-drag='true']"));
};

export function TauriTitlebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const tc = useTranslations("common");
  const ts = useTranslations("search");
  const tsh = useTranslations("shell");
  const headerSearchQuery = searchParams.get("q") ?? "";
  const [isTauri] = useState(
    () =>
      typeof window !== "undefined" && window.starchildTauri?.isTauri === true,
  );
  const [isMaximized, setIsMaximized] = useState(false);
  const [draftSearchText, setDraftSearchText] = useState(headerSearchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchBlurTimerRef = useRef<number | null>(null);
  const searchInputValue = isSearchFocused
    ? draftSearchText
    : headerSearchQuery;

  const { data: recentSearches = [] } = api.music.getRecentSearches.useQuery(
    { limit: 12 },
    { enabled: !!session && isTauri },
  );

  const { suggestions } = useSearchSuggestions(
    draftSearchText,
    recentSearches,
    {
      enabled: isSearchFocused && isTauri,
      limit: 10,
    },
  );

  useEffect(() => {
    if (!isTauri) return;

    const tauri = window.starchildTauri;
    if (!tauri?.isTauri) return;

    const syncState = async () => {
      try {
        const state = await tauri.syncWindowState();
        if (isTauriWindowState(state)) {
          setIsMaximized(state.isMaximized);
        }
      } catch (error) {
        console.warn(
          "[TauriTitlebar] Failed to sync Tauri window state",
          error,
        );
      }
    };

    const handleState = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      if (!isTauriWindowState(customEvent.detail)) return;
      setIsMaximized(customEvent.detail.isMaximized);
    };

    window.addEventListener(
      "starchild:tauri-window-state",
      handleState as EventListener,
    );
    void syncState();

    return () => {
      window.removeEventListener(
        "starchild:tauri-window-state",
        handleState as EventListener,
      );
    };
  }, [isTauri]);

  useEffect(() => {
    return () => {
      if (searchBlurTimerRef.current !== null) {
        window.clearTimeout(searchBlurTimerRef.current);
      }
    };
  }, []);

  const tabs = useMemo(
    () => [
      { href: "/", label: tc("home") },
      { href: "/library", label: tc("library") },
      { href: "/playlists", label: tc("playlists") },
      { href: "/settings", label: tc("settings"), icon: Settings },
    ],
    [tc],
  );

  if (!isTauri) return null;

  const showSuggestions =
    isSearchFocused &&
    draftSearchText.trim().length > 0 &&
    suggestions.length > 0;

  const submitSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) {
      router.push("/", { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set("q", query);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const selectSuggestion = (suggestion: SearchSuggestionItem) => {
    setDraftSearchText(suggestion.query);
    setIsSearchFocused(false);
    setActiveSuggestionIndex(-1);
    submitSearch(suggestion.query);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
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

  const invokeWindowAction = async (
    action: "minimize" | "toggleMaximize" | "close" | "startDragging",
  ) => {
    const tauri = window.starchildTauri;
    if (!tauri?.isTauri) return;

    try {
      if (action === "minimize") {
        await tauri.minimize();
        return;
      }

      if (action === "close") {
        await tauri.close();
        return;
      }

      if (action === "startDragging") {
        await tauri.startDragging();
        return;
      }

      const nextState = await tauri.toggleMaximize();
      if (isTauriWindowState(nextState)) {
        setIsMaximized(nextState.isMaximized);
      }
    } catch (error) {
      console.warn(`[TauriTitlebar] Failed to ${action}`, error);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.detail > 1 ||
      shouldSkipWindowDrag(event.target)
    ) {
      return;
    }

    void invokeWindowAction("startDragging");
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldSkipWindowDrag(event.target)) {
      return;
    }

    void invokeWindowAction("toggleMaximize");
  };

  return (
    <header className="tauri-titlebar fixed inset-x-0 top-0 z-40 px-[var(--desktop-window-frame-gap)] pt-[var(--desktop-window-frame-gap)]">
      <div
        className="tauri-titlebar-shell rounded-[calc(var(--desktop-window-radius)-1px)] border px-3 py-2"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <div className="tauri-titlebar-inner grid grid-cols-[auto_minmax(18rem,34rem)_auto] items-center gap-3">
          <nav
            className="tauri-tabbar flex items-center gap-1 rounded-full border px-1 py-1"
            aria-label="Desktop tabs"
            data-no-window-drag="true"
          >
            {tabs.map((tab) => {
              const active =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tauri-tab flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "is-active text-[var(--color-text)]"
                      : "text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                  data-no-window-drag="true"
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          <div
            className="tauri-titlebar-search relative"
            data-no-window-drag="true"
          >
            <form
              className="tauri-search-shell flex h-10 items-center gap-2 rounded-full border px-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch(draftSearchText);
                setIsSearchFocused(false);
                setActiveSuggestionIndex(-1);
              }}
              data-no-window-drag="true"
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              <input
                value={searchInputValue}
                onChange={(event) => {
                  setDraftSearchText(event.target.value);
                  setActiveSuggestionIndex(-1);
                }}
                onFocus={() => {
                  if (searchBlurTimerRef.current !== null) {
                    window.clearTimeout(searchBlurTimerRef.current);
                    searchBlurTimerRef.current = null;
                  }
                  setDraftSearchText(searchInputValue);
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
                data-no-window-drag="true"
              />
              <button
                type="submit"
                className="tauri-search-submit inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold"
                data-no-window-drag="true"
              >
                <span className="hidden sm:inline">{tc("search")}</span>
                <span className="sm:hidden">
                  <Search className="h-3.5 w-3.5" />
                </span>
              </button>
            </form>
            {showSuggestions ? (
              <SearchSuggestionsList
                suggestions={suggestions}
                activeIndex={activeSuggestionIndex}
                onActiveIndexChange={setActiveSuggestionIndex}
                onSelect={selectSuggestion}
                className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-50"
              />
            ) : null}
          </div>

          <div
            className="tauri-window-controls"
            role="group"
            aria-label={tsh("windowControls")}
            data-no-window-drag="true"
          >
            <div className="tauri-window-controls-shell">
              <button
                type="button"
                className="tauri-window-control"
                aria-label={tsh("minimizeWindow")}
                title={tsh("minimize")}
                onClick={() => void invokeWindowAction("minimize")}
                data-no-window-drag="true"
              >
                <Minus className="h-3.5 w-3.5 stroke-[2.4]" />
              </button>
              <button
                type="button"
                className="tauri-window-control"
                aria-label={
                  isMaximized ? tsh("restoreWindow") : tsh("maximizeWindow")
                }
                title={isMaximized ? tsh("restore") : tsh("maximize")}
                onClick={() => void invokeWindowAction("toggleMaximize")}
                data-no-window-drag="true"
              >
                {isMaximized ? (
                  <Minimize2 className="h-[11px] w-[11px] stroke-[2.3]" />
                ) : (
                  <Maximize2 className="h-[11px] w-[11px] stroke-[2.3]" />
                )}
              </button>
              <button
                type="button"
                className="tauri-window-control tauri-window-control-close"
                aria-label={tsh("closeWindow")}
                title={tsh("close")}
                onClick={() => void invokeWindowAction("close")}
                data-no-window-drag="true"
              >
                <X className="h-3.5 w-3.5 stroke-[2.4]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
