// File: apps/web/src/components/Queue.tsx

"use client";

import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import type { QueueItem } from "@starchild/types";
import { Trash2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { MouseEvent } from "react";

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface QueueProps {
  queue: QueueItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function Queue({ queue, onClose, onRemove, onClear }: QueueProps) {
  const t = useTranslations("queue");
  const { openMenu } = useTrackContextMenu();
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, track: QueueItem["track"]) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu(track, event.clientX, event.clientY);
    },
    [openMenu],
  );

  return (
    <div className="theme-chrome-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l">
      {}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <h2 className="text-xl font-bold text-[var(--color-text)]">
          {t("title", { count: queue.length })}
        </h2>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={onClear}
              className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              aria-label={t("clearQueue")}
              title={t("clearQueue")}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-[var(--color-surface-hover)]"
            aria-label={t("closeQueue")}
          >
            <X className="h-6 w-6 text-[var(--color-subtext)]" />
          </button>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[var(--color-muted)]">
            <div className="mb-4 text-6xl">🎵</div>
            <p className="mb-2 text-lg font-medium">{t("emptyTitle")}</p>
            <p className="text-sm">{t("emptyDescription")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
                {queue.map((item, index) => {
                  const coverImage =
                    item.track.album.cover_small ?? item.track.album.cover;

                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 p-3 transition-colors hover:bg-[var(--color-surface-hover)]"
                      onContextMenu={(event) =>
                        handleContextMenu(event, item.track)
                      }
                    >
                  {}
                  <div className="w-6 flex-shrink-0 text-center text-sm text-[var(--color-muted)]">
                    {index + 1}
                  </div>

                  {}
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-[var(--color-surface-hover)]">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={item.track.album.title}
                        fill
                        sizes="(max-width: 768px) 48px, 64px"
                        className="object-cover"
                        quality={75}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--color-muted)]">
                        🎵
                      </div>
                    )}
                  </div>

                  {}
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-[var(--color-text)]">
                      {item.track.title}
                    </h4>
                    <p className="truncate text-xs text-[var(--color-subtext)]">
                      {item.track.artist.name}
                    </p>
                  </div>

                  {}
                  <span className="flex-shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                    {formatDuration(item.track.duration)}
                  </span>

                  {}
                  <button
                    onClick={() => onRemove(item.id)}
                    className="flex-shrink-0 rounded p-1.5 opacity-0 transition-colors group-hover:opacity-100 hover:bg-[var(--color-surface-hover)]"
                    aria-label={t("removeFromQueue")}
                  >
                    <X className="h-4 w-4 text-[var(--color-subtext)] hover:text-[var(--color-text)]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {}
      {queue.length > 0 && (
        <div className="border-t border-gray-800 p-4 text-sm text-gray-400">
          {t("totalDuration")}{" "}
          {formatDuration(
            queue.reduce((acc, item) => acc + item.track.duration, 0),
          )}
        </div>
      )}
    </div>
  );
}
