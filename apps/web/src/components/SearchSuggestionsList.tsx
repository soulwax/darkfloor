// File: apps/web/src/components/SearchSuggestionsList.tsx

"use client";

import type { SearchSuggestionItem } from "@starchild/types/searchSuggestions";
import { Disc3, Music2, Search, UserRound } from "lucide-react";
import Image from "next/image";

interface SearchSuggestionsListProps {
  suggestions: SearchSuggestionItem[];
  activeIndex: number;
  onActiveIndexChange?: (index: number) => void;
  onSelect: (suggestion: SearchSuggestionItem) => void;
  className?: string;
}

const iconByType = {
  query: Search,
  track: Music2,
  artist: UserRound,
  album: Disc3,
} as const;

const labelByType = {
  query: "Recent",
  track: "Track",
  artist: "Artist",
  album: "Album",
} as const;

export function SearchSuggestionsList({
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  className = "",
}: SearchSuggestionsListProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={`theme-panel overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl ${className}`.trim()}
      role="listbox"
      aria-label="Search suggestions"
    >
      <div className="max-h-80 overflow-y-auto py-1.5">
        {suggestions.map((suggestion, index) => {
          const Icon = iconByType[suggestion.type];
          const isActive = index === activeIndex;

          return (
            <button
              key={suggestion.id}
              type="button"
              onMouseEnter={() => onActiveIndexChange?.(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(suggestion);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-[rgba(244,178,102,0.14)]"
                  : "hover:bg-[rgba(244,178,102,0.08)]"
              }`}
              role="option"
              aria-selected={isActive}
            >
              {suggestion.artwork ? (
                <Image
                  src={suggestion.artwork}
                  alt={suggestion.label}
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-[rgba(255,255,255,0.08)] text-[var(--color-subtext)]">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                  {suggestion.label}
                </span>
                {suggestion.sublabel && (
                  <span className="mt-0.5 block truncate text-xs text-[var(--color-subtext)]">
                    {suggestion.sublabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                {labelByType[suggestion.type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
