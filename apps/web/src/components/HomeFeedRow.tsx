// File: apps/web/src/components/HomeFeedRow.tsx

"use client";

import type { Track } from "@starchild/types";
import { getCoverImage } from "@/utils/images";
import { formatDuration } from "@/utils/time";
import { Play } from "lucide-react";
import Image from "next/image";
import { memo } from "react";

interface HomeFeedRowProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading?: boolean;
  emptyLabel?: string;
}

function HomeFeedRowInner({
  title,
  subtitle,
  tracks,
  onTrackSelect,
  isLoading = false,
  emptyLabel = "No tracks yet.",
}: HomeFeedRowProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--color-text)] md:text-lg">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--color-subtext)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="w-[152px] shrink-0 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-2.5"
            >
              <div className="h-[124px] w-full animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-1 h-2.5 w-2/3 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            </div>
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-xs text-[var(--color-subtext)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="desktop-scroll flex gap-3 overflow-x-auto pb-1">
          {tracks.map((track, index) => (
            <button
              key={`${title}-${track.id}-${index}`}
              type="button"
              onClick={() => onTrackSelect(track)}
              className="group w-[152px] shrink-0 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-2.5 text-left transition-all hover:border-[rgba(244,178,102,0.28)] hover:bg-[rgba(244,178,102,0.08)]"
            >
              <div className="relative">
                <Image
                  src={getCoverImage(track, "medium")}
                  alt={track.title}
                  width={128}
                  height={128}
                  className="h-[124px] w-full rounded-lg object-cover ring-1 ring-white/10"
                  loading="lazy"
                  quality={75}
                />
                <span className="absolute right-2 bottom-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] opacity-90 shadow-md transition-opacity group-hover:opacity-100">
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
                {track.title}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-subtext)]">
                {track.artist.name}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {formatDuration(track.duration)}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export const HomeFeedRow = memo(HomeFeedRowInner);
