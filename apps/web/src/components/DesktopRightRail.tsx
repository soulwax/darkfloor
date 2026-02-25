// File: apps/web/src/components/DesktopRightRail.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { hapticLight } from "@/utils/haptics";
import { getCoverImage } from "@/utils/images";
import { formatDuration } from "@/utils/time";
import {
  ArrowUp,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  Save,
  Shuffle,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

type RemovedQueueItem = {
  track: Track;
  index: number;
  timerId: number;
};

export function DesktopRightRail() {
  const player = useGlobalPlayer();
  const { openMenu } = useTrackContextMenu();
  const currentTrack = player.currentTrack;
  const upNext = player.queue.slice(1);
  const upcomingDuration = upNext.reduce(
    (total, track) => total + (track.duration ?? 0),
    0,
  );
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lastRemoved, setLastRemoved] = useState<RemovedQueueItem | null>(null);

  useEffect(() => {
    return () => {
      if (lastRemoved) {
        window.clearTimeout(lastRemoved.timerId);
      }
    };
  }, [lastRemoved]);

  const handleMoveToNext = useCallback(
    (queueIndex: number) => {
      if (queueIndex <= 1) return;
      player.reorderQueue(queueIndex, 1);
    },
    [player],
  );

  const handleRemoveWithUndo = useCallback(
    (queueIndex: number) => {
      const track = player.queue[queueIndex];
      if (!track) return;

      if (lastRemoved) {
        window.clearTimeout(lastRemoved.timerId);
      }

      player.removeFromQueue(queueIndex);

      const timerId = window.setTimeout(() => {
        setLastRemoved(null);
      }, 5000);

      setLastRemoved({
        track,
        index: queueIndex,
        timerId,
      });
    },
    [lastRemoved, player],
  );

  const handleUndoRemove = useCallback(() => {
    if (!lastRemoved) return;

    window.clearTimeout(lastRemoved.timerId);
    const restoredIndex = lastRemoved.index;

    player.addToPlayNext(lastRemoved.track);

    if (restoredIndex > 1) {
      window.setTimeout(() => {
        player.reorderQueue(1, restoredIndex);
      }, 0);
    }

    setLastRemoved(null);
  }, [lastRemoved, player]);

  const handleDrop = useCallback(() => {
    if (
      draggingIndex === null ||
      dragOverIndex === null ||
      draggingIndex === dragOverIndex
    ) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }

    player.reorderQueue(draggingIndex, dragOverIndex);
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, [dragOverIndex, draggingIndex, player]);

  const handleQueueTrackContextMenu = useCallback(
    (track: Track, queueIndex: number, event: MouseEvent) => {
      event.preventDefault();
      hapticLight();

      const maxQueueIndex = player.queue.length - 1;
      const canMoveToNext = queueIndex > 1;
      const canMoveToEnd = queueIndex < maxQueueIndex;

      openMenu(track, event.clientX, event.clientY, {
        queueActions: {
          isQueued: true,
          onPlayFromQueue: () => player.playFromQueue(queueIndex),
          onMoveToNext: canMoveToNext
            ? () => player.reorderQueue(queueIndex, 1)
            : undefined,
          onMoveToEnd: canMoveToEnd
            ? () => player.reorderQueue(queueIndex, maxQueueIndex)
            : undefined,
        },
        removeFromList: {
          label: "Remove from queue",
          onRemove: () => handleRemoveWithUndo(queueIndex),
        },
      });
    },
    [handleRemoveWithUndo, openMenu, player],
  );

  return (
    <aside className="desktop-right-rail block h-full w-[320px] shrink-0 p-2 pr-3 max-xl:hidden">
      <div className="desktop-surface flex h-full min-h-0 flex-col overflow-hidden rounded-[1.25rem] border px-4 py-4">
        <section className="border-b border-[rgba(255,255,255,0.08)] pb-4">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
            Now Playing
          </p>
          {currentTrack ? (
            <div className="flex items-start gap-3">
              <Image
                src={getCoverImage(currentTrack, "medium")}
                alt={currentTrack.title}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover shadow-md ring-1 ring-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">
                  {currentTrack.title}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-[var(--color-subtext)]">
                  {currentTrack.artist.name}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {formatDuration(currentTrack.duration)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-xs text-[var(--color-subtext)]">
              Start playback to populate your queue.
            </div>
          )}
        </section>

        <section className="pt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void player.togglePlay()}
              disabled={!currentTrack}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              {player.isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {player.isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={player.playNext}
              disabled={player.queue.length < 2}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Next
            </button>
            <button
              type="button"
              onClick={player.toggleShuffle}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {player.isShuffled ? "Shuffling" : "Shuffle"}
            </button>
            <button
              type="button"
              onClick={player.clearQueue}
              disabled={player.queue.length === 0}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => void player.saveQueueAsPlaylist()}
              disabled={player.queue.length === 0}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              Save Queue
            </button>
            <button
              type="button"
              onClick={() => void player.addSmartTracks(5)}
              disabled={!currentTrack}
              className="btn-secondary inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Smart +5
            </button>
          </div>
        </section>

        <section className="mt-4 min-h-0 flex-1 overflow-hidden border-t border-[rgba(255,255,255,0.08)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
              Up Next
            </p>
            <span className="text-[10px] text-[var(--color-muted)]">
              {upNext.length > 0
                ? `${upNext.length} tracks • ${formatDuration(upcomingDuration)}`
                : "No upcoming tracks"}
            </span>
          </div>

          {upNext.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 text-xs text-[var(--color-subtext)]">
              Queue is empty.
            </div>
          ) : (
            <div className="desktop-scroll h-full overflow-y-auto pr-1">
              <div className="space-y-1.5">
                {upNext.map((track, index) => {
                  const queueIndex = index + 1;
                  return (
                    <div
                      key={`${track.id}-${queueIndex}-${track.title}`}
                      draggable
                      onContextMenu={(event) =>
                        handleQueueTrackContextMenu(track, queueIndex, event)
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingIndex(queueIndex);
                        setDragOverIndex(queueIndex);
                      }}
                      onDragEnd={() => {
                        setDraggingIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverIndex(queueIndex);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop();
                      }}
                      className={`group flex cursor-grab items-center gap-2.5 rounded-lg border bg-[rgba(255,255,255,0.02)] px-2.5 py-2 transition-colors active:cursor-grabbing ${
                        dragOverIndex === queueIndex
                          ? "border-[rgba(244,178,102,0.35)] bg-[rgba(244,178,102,0.14)]"
                          : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(244,178,102,0.22)] hover:bg-[rgba(244,178,102,0.08)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => player.playFromQueue(queueIndex)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        title="Play now"
                      >
                        <Image
                          src={getCoverImage(track, "small")}
                          alt={track.title}
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-md object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-[var(--color-text)]">
                            {track.title}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--color-subtext)]">
                            {track.artist.name}
                          </span>
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                          {formatDuration(track.duration)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToNext(queueIndex)}
                        disabled={queueIndex === 1}
                        className="rounded-md p-1 text-[var(--color-subtext)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(88,198,177,0.16)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Move ${track.title} to play next`}
                        title={queueIndex === 1 ? "Already next" : "Play next"}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWithUndo(queueIndex)}
                        className="rounded-md p-1 text-[var(--color-subtext)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(242,139,130,0.16)] hover:text-[var(--color-text)]"
                        aria-label={`Remove ${track.title} from queue`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="mt-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[var(--color-subtext)] uppercase">
            <ListMusic className="h-3 w-3" />
            Queue Controls
          </div>
          {lastRemoved ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[rgba(244,178,102,0.22)] bg-[rgba(244,178,102,0.08)] px-2.5 py-2 text-xs text-[var(--color-text)]">
              <span className="line-clamp-2 min-w-0 flex-1">
                Removed &quot;{lastRemoved.track.title}&quot;
              </span>
              <button
                type="button"
                onClick={handleUndoRemove}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[rgba(88,198,177,0.18)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[rgba(88,198,177,0.28)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
