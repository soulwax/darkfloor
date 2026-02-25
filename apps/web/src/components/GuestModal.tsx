// File: apps/web/src/components/GuestModal.tsx

"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { localStorage as appStorage } from "@/services/storage";
import { startSpotifyLogin } from "@/services/spotifyAuthClient";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";
import { parsePreferredGenreId } from "@/utils/genre";
import { settingsStorage } from "@/utils/settingsStorage";
import { getGenres, type GenreListItem } from "@starchild/api-client/rest";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { ChevronDown, Music2, X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface GuestModalProps {
  onContinueAsGuest?: () => void;
  callbackUrl?: string;
}

type SimilarityPreference = "strict" | "balanced" | "diverse";
type MoodPresetId = "chill" | "focus" | "hype" | "discover";

type MoodPreset = {
  id: MoodPresetId;
  label: string;
  hint: string;
  similarity: SimilarityPreference;
  autoQueue: boolean;
  smartMix: boolean;
};

type GenreOption = {
  id: number | null;
  name: string;
};

const GENRE_MENU_PAGE_STEP = 8;
const GENRE_MENU_MAX_HEIGHT = 400;
const GENRE_MENU_VERTICAL_OFFSET = 8;
const GENRE_MENU_HORIZONTAL_PADDING = 8;

const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "chill",
    label: "Chill",
    hint: "Smooth + relaxed",
    similarity: "diverse",
    autoQueue: false,
    smartMix: true,
  },
  {
    id: "focus",
    label: "Focus",
    hint: "Tighter matches",
    similarity: "strict",
    autoQueue: false,
    smartMix: true,
  },
  {
    id: "hype",
    label: "Hype",
    hint: "Faster queue flow",
    similarity: "balanced",
    autoQueue: true,
    smartMix: true,
  },
  {
    id: "discover",
    label: "Discover",
    hint: "Broader variety",
    similarity: "diverse",
    autoQueue: true,
    smartMix: false,
  },
];

function applyThemeClass(): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.add("theme-dark");
  html.classList.remove("theme-light");
}

function resolveInitialMood(
  similarityPreference: SimilarityPreference,
  autoQueueEnabled: boolean,
  smartMixEnabled: boolean,
): MoodPresetId {
  const match = MOOD_PRESETS.find(
    (preset) =>
      preset.similarity === similarityPreference &&
      preset.autoQueue === autoQueueEnabled &&
      preset.smartMix === smartMixEnabled,
  );
  return match?.id ?? "chill";
}

function getNextGenreOptionIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
): number {
  if (optionCount <= 0) return 0;

  const lastIndex = optionCount - 1;

  switch (key) {
    case "ArrowDown":
      return Math.min(currentIndex + 1, lastIndex);
    case "ArrowUp":
      return Math.max(currentIndex - 1, 0);
    case "PageDown":
      return Math.min(currentIndex + GENRE_MENU_PAGE_STEP, lastIndex);
    case "PageUp":
      return Math.max(currentIndex - GENRE_MENU_PAGE_STEP, 0);
    case "Home":
      return 0;
    case "End":
      return lastIndex;
    default:
      return currentIndex;
  }
}

/**
 * Scroll model:
 * - The Dialog shell is fixed and non-scrolling; only `.guest-modal-content-scroll` scrolls.
 * - Long dropdown lists render in a body portal and scroll inside `.guest-modal-dropdown-scroll`.
 * - Both scroll layers use `overscroll-behavior: contain` so wheel/touch never bleed to page/body.
 * Extend this by reusing the same portal-list + contained-scroll classes for other modal dropdowns.
 */
export function GuestModal({
  onContinueAsGuest,
  callbackUrl = "/library",
}: GuestModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [genres, setGenres] = useState<GenreListItem[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [preferredGenreId, setPreferredGenreId] = useState<number | null>(() =>
    parsePreferredGenreId(
      appStorage.getOrDefault<number | string | null>(
        STORAGE_KEYS.PREFERRED_GENRE_ID,
        null,
      ),
    ),
  );
  const [preferredGenreName, setPreferredGenreName] = useState<string>(() =>
    appStorage.getOrDefault<string>(STORAGE_KEYS.PREFERRED_GENRE_NAME, ""),
  );
  const [selectedMoodId, setSelectedMoodId] = useState<MoodPresetId>(() =>
    resolveInitialMood(
      settingsStorage.getSetting("similarityPreference", "balanced"),
      settingsStorage.getSetting("autoQueueEnabled", false),
      settingsStorage.getSetting("smartMixEnabled", true),
    ),
  );
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);
  const [genreMenuRect, setGenreMenuRect] = useState<DOMRect | null>(null);
  const [genreMenuDirection, setGenreMenuDirection] = useState<"down" | "up">(
    "down",
  );
  const [viewportHeight, setViewportHeight] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [genreMenuMaxHeight, setGenreMenuMaxHeight] = useState<number>(320);
  const [highlightedGenreIndex, setHighlightedGenreIndex] = useState(0);
  const genreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const genreListboxRef = useRef<HTMLDivElement | null>(null);

  const selectedMood = useMemo(
    () => MOOD_PRESETS.find((preset) => preset.id === selectedMoodId) ?? null,
    [selectedMoodId],
  );
  const genreOptions = useMemo<GenreOption[]>(
    () => [{ id: null, name: "No preference" }, ...genres],
    [genres],
  );
  const selectedGenre = useMemo(
    () => genres.find((genre) => genre.id === preferredGenreId) ?? null,
    [genres, preferredGenreId],
  );
  const selectedGenreLabel = useMemo(() => {
    if (genresLoading) return "Loading genres...";
    if (preferredGenreName.trim().length > 0) return preferredGenreName;
    if (selectedGenre?.name) return selectedGenre.name;
    if (genres.length > 0) return "No preference";
    return "Genres unavailable";
  }, [genres, genresLoading, preferredGenreName, selectedGenre]);
  const genreSelectDisabled = genresLoading || genres.length === 0;
  const genreSummaryLabel = selectedGenre?.name ?? preferredGenreName;
  const selectedGenreOptionIndex = useMemo(() => {
    const index = genreOptions.findIndex(
      (option) => option.id === preferredGenreId,
    );
    return index >= 0 ? index : 0;
  }, [genreOptions, preferredGenreId]);

  function setGenrePreference(genre: GenreListItem | null): void {
    if (!genre) {
      setPreferredGenreId(null);
      setPreferredGenreName("");
      appStorage.remove(STORAGE_KEYS.PREFERRED_GENRE_ID);
      appStorage.remove(STORAGE_KEYS.PREFERRED_GENRE_NAME);
      return;
    }

    setPreferredGenreId(genre.id);
    setPreferredGenreName(genre.name);
    appStorage.set(STORAGE_KEYS.PREFERRED_GENRE_ID, genre.id);
    appStorage.set(STORAGE_KEYS.PREFERRED_GENRE_NAME, genre.name);
  }

  function closeGenreMenu(): void {
    setIsGenreMenuOpen(false);
  }

  function selectGenreByIndex(optionIndex: number): void {
    const option = genreOptions[optionIndex];
    if (!option) return;

    if (option.id === null) {
      setGenrePreference(null);
    } else {
      const genre = genres.find((item) => item.id === option.id) ?? null;
      if (!genre) return;
      setGenrePreference(genre);
    }

    closeGenreMenu();
    genreTriggerRef.current?.focus();
  }

  const handleGenreTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (genreSelectDisabled) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "PageDown":
      case "PageUp":
      case "Home":
      case "End": {
        event.preventDefault();
        const baseIndex = isGenreMenuOpen
          ? highlightedGenreIndex
          : selectedGenreOptionIndex;
        const nextIndex = getNextGenreOptionIndex(
          event.key,
          baseIndex,
          genreOptions.length,
        );
        if (!isGenreMenuOpen) {
          setIsGenreMenuOpen(true);
        }
        setHighlightedGenreIndex(nextIndex);
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (!isGenreMenuOpen) {
          setIsGenreMenuOpen(true);
          setHighlightedGenreIndex(selectedGenreOptionIndex);
          return;
        }
        selectGenreByIndex(highlightedGenreIndex);
        return;
      }
      case "Escape": {
        if (!isGenreMenuOpen) return;
        event.preventDefault();
        closeGenreMenu();
        return;
      }
      case "Tab": {
        if (isGenreMenuOpen) {
          closeGenreMenu();
        }
        return;
      }
      default:
        return;
    }
  };

  const genreMenuStyle = useMemo(() => {
    if (!genreMenuRect) return undefined;

    const boundedViewportWidth =
      viewportWidth > 0 ? viewportWidth : genreMenuRect.width + 2 * GENRE_MENU_HORIZONTAL_PADDING;
    const maxMenuWidth = Math.max(
      boundedViewportWidth - GENRE_MENU_HORIZONTAL_PADDING * 2,
      160,
    );
    const menuWidth = Math.min(genreMenuRect.width, maxMenuWidth);
    const maxLeft = Math.max(
      GENRE_MENU_HORIZONTAL_PADDING,
      boundedViewportWidth - menuWidth - GENRE_MENU_HORIZONTAL_PADDING,
    );
    const menuLeft = Math.min(
      Math.max(genreMenuRect.left, GENRE_MENU_HORIZONTAL_PADDING),
      maxLeft,
    );

    const baseStyle = {
      position: "fixed" as const,
      left: menuLeft,
      width: menuWidth,
    };

    if (genreMenuDirection === "up") {
      return {
        ...baseStyle,
        bottom: Math.max(
          viewportHeight - genreMenuRect.top + GENRE_MENU_VERTICAL_OFFSET,
          GENRE_MENU_VERTICAL_OFFSET,
        ),
      };
    }

    return {
      ...baseStyle,
      top: genreMenuRect.bottom + GENRE_MENU_VERTICAL_OFFSET,
    };
  }, [genreMenuDirection, genreMenuRect, viewportHeight, viewportWidth]);

  const stopGenreListScrollPropagation = (
    event: React.WheelEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
  };

  const activeGenreOptionId = `guest-preferred-genre-option-${highlightedGenreIndex}`;
  const genreDropdownPortal =
    typeof document !== "undefined" && isGenreMenuOpen && genreMenuStyle
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[240]"
              onClick={closeGenreMenu}
              aria-hidden="true"
            />
            <div
              id="guest-preferred-genre-listbox"
              role="listbox"
              aria-label="Genre options"
              className="theme-panel fixed z-[241] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl"
              style={genreMenuStyle}
            >
              <div
                ref={genreListboxRef}
                className="guest-modal-dropdown-scroll max-h-[min(60vh,400px)] touch-pan-y overflow-y-auto py-1"
                style={{ maxHeight: `${genreMenuMaxHeight}px` }}
                onWheelCapture={stopGenreListScrollPropagation}
                onTouchMoveCapture={stopGenreListScrollPropagation}
              >
                {genreOptions.map((option, index) => {
                  const isSelected = preferredGenreId === option.id;
                  const isHighlighted = highlightedGenreIndex === index;

                  return (
                    <button
                      key={option.id ?? "none"}
                      id={`guest-preferred-genre-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-guest-genre-index={index}
                      onMouseEnter={() => setHighlightedGenreIndex(index)}
                      onClick={() => selectGenreByIndex(index)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-[#1DB954]/20 text-white"
                          : isHighlighted
                            ? "bg-white/[0.08] text-white"
                            : "text-white/85 hover:bg-white/[0.08] hover:text-white",
                      )}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  useEffect(() => {
    settingsStorage.set("theme", "dark");
    applyThemeClass();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !isOpen) return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.paddingRight = previousBodyPaddingRight;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;

    void getGenres(80)
      .then((items) => {
        if (!isMounted) return;
        const normalized = items
          .filter((item) => item.id > 0 && item.name.trim().length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        setGenres(normalized);
      })
      .catch(() => {
        if (!isMounted) return;
        setGenres([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setGenresLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isGenreMenuOpen || !genreTriggerRef.current) return;

    const updateRect = () => {
      const rect = genreTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextViewportHeight = window.innerHeight;
      const nextViewportWidth = window.innerWidth;
      const spaceBelow = nextViewportHeight - rect.bottom - GENRE_MENU_VERTICAL_OFFSET;
      const spaceAbove = rect.top - GENRE_MENU_VERTICAL_OFFSET;
      const nextDirection =
        spaceBelow < 280 && spaceAbove > spaceBelow ? "up" : "down";
      const directionalSpace = nextDirection === "up" ? spaceAbove : spaceBelow;
      const viewportBoundedMaxHeight = Math.min(
        Math.floor(nextViewportHeight * 0.6),
        GENRE_MENU_MAX_HEIGHT,
      );
      const nextMaxHeight = Math.min(
        viewportBoundedMaxHeight,
        directionalSpace > 0 ? directionalSpace : viewportBoundedMaxHeight,
      );

      setGenreMenuRect(rect);
      setViewportHeight(nextViewportHeight);
      setViewportWidth(nextViewportWidth);
      setGenreMenuDirection(nextDirection);
      setGenreMenuMaxHeight(nextMaxHeight);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isGenreMenuOpen]);

  useEffect(() => {
    if (!isGenreMenuOpen) return;
    const listbox = genreListboxRef.current;
    if (!listbox) return;
    const activeOption = listbox.querySelector<HTMLElement>(
      `[data-guest-genre-index="${highlightedGenreIndex}"]`,
    );
    activeOption?.scrollIntoView({ block: "nearest" });
  }, [highlightedGenreIndex, isGenreMenuOpen]);

  const applyMoodPreset = (preset: MoodPreset): void => {
    setSelectedMoodId(preset.id);
    settingsStorage.set("similarityPreference", preset.similarity);
    settingsStorage.set("autoQueueEnabled", preset.autoQueue);
    settingsStorage.set("smartMixEnabled", preset.smartMix);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          setIsGenreMenuOpen(false);
          onContinueAsGuest?.();
        }
      }}
    >
      <DialogContent
        className={cn(
          "!top-0 !left-0 !m-0 !h-screen !w-screen !max-h-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden border-0 bg-[#0F1528]/95 p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)] focus:outline-none",
          "h-[100dvh] max-h-[100dvh] rounded-none",
          "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          "data-[state=closed]:!translate-y-full data-[state=open]:!translate-y-0",
          "sm:!top-1/2 sm:!left-1/2 sm:!h-auto sm:!w-[min(40rem,calc(100%-2rem))] sm:!max-h-[calc(100dvh-2rem)] sm:!max-w-[40rem] sm:!-translate-x-1/2 sm:!-translate-y-1/2",
          "sm:rounded-3xl sm:border sm:border-white/12 sm:p-0",
          "sm:data-[state=closed]:!translate-y-3 sm:data-[state=closed]:scale-[0.98] sm:data-[state=open]:scale-100",
        )}
      >
        <div className="flex max-h-full min-h-0 flex-col overscroll-none">
          <div className="flex justify-center pt-2 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/30" />
          </div>

          <DialogHeader className="border-b border-white/12 px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1DB954]/35 bg-[#1DB954]/12 sm:h-11 sm:w-11">
                  <Music2 className="h-5 w-5 text-[#1DB954]" />
                </div>
                <div>
                  <DialogTitle className="text-[15px] leading-5 text-white sm:text-lg sm:leading-6">
                    Tune the start page and optionally sign in
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs leading-relaxed text-white/72 sm:text-sm">
                    Save local tuning defaults now. You can still skip and start
                    listening immediately.
                  </DialogDescription>
                </div>
              </div>

              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.03] text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white sm:h-10 sm:w-10"
                  aria-label="Close and skip sign-in"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div
            className={cn(
              "guest-modal-content-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto",
              "space-y-3 px-3 pt-3 pb-4",
              "text-sm sm:px-5",
            )}
          >
            <section className="space-y-3 rounded-2xl border border-white/12 bg-white/[0.03] p-2.5 sm:p-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-white/72 uppercase">
                Tune Start Page
              </p>

              <div className="space-y-1">
                <p
                  id="guest-preferred-genre-label"
                  className="text-xs font-medium text-white/80"
                >
                  Genre
                </p>
                <div className="relative">
                  <button
                    ref={genreTriggerRef}
                    type="button"
                    role="combobox"
                    id="guest-preferred-genre"
                    aria-labelledby="guest-preferred-genre-label"
                    aria-haspopup="listbox"
                    aria-controls="guest-preferred-genre-listbox"
                    aria-expanded={isGenreMenuOpen}
                    aria-activedescendant={
                      isGenreMenuOpen ? activeGenreOptionId : undefined
                    }
                    disabled={genreSelectDisabled}
                    onClick={() => {
                      setIsGenreMenuOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setHighlightedGenreIndex(selectedGenreOptionIndex);
                        }
                        return next;
                      });
                    }}
                    onKeyDown={handleGenreTriggerKeyDown}
                    className={cn(
                      "h-12 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 pr-10 text-left text-sm text-white transition-colors outline-none focus:border-[#1DB954]/70",
                      genreSelectDisabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="block truncate">{selectedGenreLabel}</span>
                  </button>
                  <ChevronDown
                    className={cn(
                      "pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-white/70 transition-transform",
                      isGenreMenuOpen && "rotate-180",
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-white/80">Mood</p>
                <div className="grid grid-cols-2 gap-2">
                  {MOOD_PRESETS.map((preset) => {
                    const selected = selectedMoodId === preset.id;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => applyMoodPreset(preset)}
                        className={cn(
                          "h-12 rounded-xl border px-2 text-left transition-all duration-200 ease-out",
                          selected
                            ? "border-[#1DB954]/70 bg-[#1DB954]/18 text-white"
                            : "border-white/15 bg-white/[0.03] text-white/82 hover:border-white/30 hover:bg-white/[0.08]",
                        )}
                      >
                        <p className="text-[13px] leading-tight font-medium sm:text-sm">
                          {preset.label}
                        </p>
                        <p className="text-[11px] text-white/65">
                          {preset.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-white/65">
                {genreSummaryLabel
                  ? `Genre: ${genreSummaryLabel}`
                  : "Genre: none selected"}{" "}
                · Mood: {selectedMood?.label ?? "Chill"}
              </p>
            </section>

            <div className="space-y-2 pb-1">
              <button
                type="button"
                onClick={() =>
                  void signIn("discord", {
                    callbackUrl: buildAuthCallbackUrl(callbackUrl, "discord"),
                  })
                }
                className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#5865F2,#7480ff)] px-4 text-[13px] font-semibold text-white transition duration-200 ease-out hover:brightness-110 active:brightness-95 sm:text-sm"
              >
                Sign in to sync preferences
              </button>

              <button
                type="button"
                onClick={() => startSpotifyLogin(callbackUrl)}
                className="h-12 w-full rounded-xl border border-[#1DB954]/40 bg-[#1DB954]/15 px-4 text-[13px] font-semibold text-white transition duration-200 ease-out hover:bg-[#1DB954]/20 sm:text-sm"
              >
                Use Spotify instead
              </button>

              <DialogClose asChild>
                <button
                  type="button"
                  className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white/92 transition duration-200 ease-out hover:border-white/30 hover:bg-white/[0.1] sm:text-sm"
                >
                  Skip for now
                </button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
      {genreDropdownPortal}
    </Dialog>
  );
}
