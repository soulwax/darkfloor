// File: apps/web/src/components/EnhancedQueue.tsx

"use client";

import { LoadingSpinner } from "@starchild/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { api } from "@starchild/api-client/trpc/react";
import type {
  QueuedTrack,
  SimilarityPreference,
  SmartQueueMetadata,
  SmartQueueState,
  Track,
} from "@starchild/types";
import { getCoverImage } from "@/utils/images";
import { formatDuration } from "@/utils/time";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    GripVertical,
    Play,
    Save,
    Search,
    Settings,
    Sparkles,
    Trash2,
    X
} from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const QueueSettingsModal = dynamic(
  () =>
    import("@/components/QueueSettingsModal").then((mod) => ({
      default: mod.QueueSettingsModal,
    })),
  { ssr: false },
);

interface QueueItemProps {
  track: Track;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  sortableId: string;
  isSmartTrack?: boolean;
  smartQueueMetadata?: SmartQueueMetadata;
  seedTrackName?: string | null;
  canRemove: boolean;
}

function formatSimilarityMethodLabel(method: string): string {
  return method
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SortableQueueItem({
  track,
  index,
  isActive,
  isSelected,
  onPlay,
  onRemove,
  onToggleSelect,
  onContextMenu,
  sortableId,
  isSmartTrack,
  smartQueueMetadata,
  seedTrackName,
  canRemove,
}: QueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const coverImage = getCoverImage(track, "small");
  const altText = track.album?.title?.trim()?.length
    ? `${track.album.title} cover art`
    : `${track.title} cover art`;

  const artistName = track.artist?.name?.trim()?.length
    ? track.artist.name
    : "Unknown Artist";
  const albumTitle = track.album?.title?.trim()?.length
    ? track.album.title
    : null;

  const similarityPercent = smartQueueMetadata
    ? Math.round(Math.max(0, Math.min(1, smartQueueMetadata.similarity)) * 100)
    : null;
  const seedLabel =
    smartQueueMetadata && seedTrackName?.trim()
      ? seedTrackName
      : smartQueueMetadata
        ? `Track #${smartQueueMetadata.seedTrackId}`
        : null;
  const methodLabel = smartQueueMetadata
    ? formatSimilarityMethodLabel(smartQueueMetadata.method)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {

        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        onToggleSelect(e);
      }}
      onContextMenu={onContextMenu}
      tabIndex={0}
      className={`group relative flex items-center gap-3 p-3 transition-colors cursor-pointer ${isSelected
          ? "bg-[rgba(88,198,177,0.18)] ring-2 ring-[rgba(88,198,177,0.4)]"
          : isActive
            ? "bg-[rgba(244,178,102,0.16)] ring-1 ring-[rgba(244,178,102,0.3)]"
            : isSmartTrack
              ? "bg-[rgba(88,198,177,0.04)] hover:bg-[rgba(88,198,177,0.08)]"
              : "hover:bg-[rgba(244,178,102,0.08)]"
        }`}
    >
      { }
      {isSmartTrack && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--color-accent-strong)] rounded-r" />
      )}

      { }
      <button
        className="flex-shrink-0 cursor-grab text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      { }
      <div className="w-6 flex-shrink-0 text-center text-sm text-[var(--color-muted)]">
        {index + 1}
      </div>

      { }
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-[rgba(255,255,255,0.05)]">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={altText}
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
        { }
        <button
          onClick={onPlay}
          className="theme-card-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          title="Play from here"
        >
          <Play className="h-5 w-5 fill-white text-white" />
        </button>
      </div>

      { }
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className="truncate text-sm font-medium text-[var(--color-text)]">
            {track.title}
          </h4>
          {isSmartTrack && smartQueueMetadata && (
            <span className="relative inline-flex shrink-0 items-center">
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="peer rounded p-0.5 text-[var(--color-accent)]/80 transition-colors hover:text-[var(--color-accent)] focus-visible:text-[var(--color-accent)]"
                aria-label="Smart queue recommendation details"
                title="Smart queue recommendation details"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-64 -translate-x-1/2 rounded-lg border border-[rgba(88,198,177,0.35)] bg-[rgba(8,10,12,0.94)] px-3 py-2 text-left text-[11px] leading-relaxed text-[var(--color-subtext)] opacity-0 shadow-lg backdrop-blur-sm transition-all duration-150 peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100"
              >
                <span className="block font-semibold text-[var(--color-text)]">
                  ✨ Auto-queued
                </span>
                {seedLabel && (
                  <span className="mt-0.5 block">Similar to: {seedLabel}</span>
                )}
                {similarityPercent !== null && methodLabel && (
                  <span className="mt-0.5 block">
                    Match: {similarityPercent}% ({methodLabel})
                  </span>
                )}
                {smartQueueMetadata.reason && (
                  <span className="mt-0.5 block">
                    Reason: {smartQueueMetadata.reason}
                  </span>
                )}
              </span>
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-subtext)]">
          <span className="truncate">{artistName}</span>
          {albumTitle && (
            <>
              <span className="text-[var(--color-muted)]">•</span>
              <span className="truncate">{albumTitle}</span>
            </>
          )}
        </div>
      </div>

      { }
      <span className="flex-shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
        {formatDuration(track.duration)}
      </span>

      { }
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 rounded p-1.5 opacity-0 transition-colors group-hover:opacity-100 hover:bg-[rgba(244,178,102,0.12)]"
          aria-label="Remove from queue"
        >
          <X className="h-4 w-4 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-text)]" />
        </button>
      )}
    </div>
  );
}

interface EnhancedQueueProps {
  queue: Track[];
  queuedTracks: QueuedTrack[];
  smartQueueState: SmartQueueState;
  currentTrack: Track | null;
  onClose: () => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onPlayFrom: (index: number) => void;
  onSaveAsPlaylist?: () => void;
  onAddSmartTracks?: (
    countOrOptions?: number | { count: number; similarityLevel: SimilarityPreference },
  ) => Promise<Track[]>;
  onRefreshSmartTracks?: () => Promise<void>;
  onClearSmartTracks?: () => void;

}

export function EnhancedQueue({
  queue,
  queuedTracks,
  smartQueueState,
  currentTrack,
  onClose,
  onRemove,
  onClear,
  onReorder,
  onPlayFrom,
  onSaveAsPlaylist,
  onAddSmartTracks,
  onRefreshSmartTracks,
  onClearSmartTracks: _onClearSmartTracks,
}: EnhancedQueueProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [smartTracksCount, setSmartTracksCount] = useState(5);
  const [similarityLevel, setSimilarityLevel] = useState<SimilarityPreference>("balanced");

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const { showToast } = useToast();
  const { openMenu } = useTrackContextMenu();
  const queueListRef = useRef<HTMLDivElement>(null);

  // Load smart queue settings
  const { data: smartQueueSettings } = api.music.getSmartQueueSettings.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  // Sync smart queue settings - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from server settings */
  useEffect(() => {
    if (smartQueueSettings) {
      setSmartTracksCount(smartQueueSettings.autoQueueCount);
      setSimilarityLevel(smartQueueSettings.similarityPreference);
    }
  }, [smartQueueSettings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (currentTrack && queueListRef.current) {
      const trackId = currentTrack.id;

      requestAnimationFrame(() => {

        const activeItem = queueListRef.current?.querySelector(
          `[data-track-id="${trackId}"]`,
        );

        if (activeItem?.isConnected) {
          activeItem.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
    }
  }, [currentTrack, queue]);

  const queueEntries = useMemo(
    () => {
      const trackNameById = new Map<number, string>();
      for (const queuedTrack of queuedTracks) {
        trackNameById.set(queuedTrack.track.id, queuedTrack.track.title);
      }
      if (currentTrack) {
        trackNameById.set(currentTrack.id, currentTrack.title);
      }

      return queuedTracks.map((qt, index) => {
        const seedTrackId = qt.smartQueueMetadata?.seedTrackId;
        return {
          track: qt.track,
          index,
          sortableId: qt.queueId,
          isSmartTrack: qt.queueSource === 'smart',
          smartQueueMetadata: qt.smartQueueMetadata,
          seedTrackName: seedTrackId ? (trackNameById.get(seedTrackId) ?? null) : null,
        };
      });
    },
    [currentTrack, queuedTracks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findIndexBySortableId = useCallback(
    (id: string) =>
      queueEntries.find((entry) => entry.sortableId === id)?.index ?? -1,
    [queueEntries],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex =
        typeof active.id === "string"
          ? findIndexBySortableId(active.id)
          : findIndexBySortableId(String(active.id));
      const newIndex =
        typeof over.id === "string"
          ? findIndexBySortableId(over.id)
          : findIndexBySortableId(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) {
      return queueEntries;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return queueEntries.filter(
      ({ track }) =>
        track.title.toLowerCase().includes(normalizedQuery) ||
        track.artist.name.toLowerCase().includes(normalizedQuery),
    );
  }, [queueEntries, searchQuery]);

  const filteredNowPlaying = filteredQueue.length > 0 ? filteredQueue[0] : null;
  const filteredUserTracks = useMemo(() => {
    return filteredQueue.slice(1).filter(entry => !entry.isSmartTrack);
  }, [filteredQueue]);

  const filteredSmartTracks = useMemo(() => {
    return filteredQueue.slice(1).filter(entry => entry.isSmartTrack);
  }, [filteredQueue]);

  const handleTrackContextMenu = useCallback(
    (track: Track, index: number, e: React.MouseEvent) => {
      e.preventDefault();

      const isCurrent = index === 0;
      const canMoveToNext = index > 1;
      const canMoveToEnd = index > 0 && index < queue.length - 1;

      openMenu(track, e.clientX, e.clientY, {
        removeFromList: isCurrent
          ? undefined
          : {
              label: "Remove from Queue",
              onRemove: () => onRemove(index),
            },
        queueActions: {
          isQueued: true,
          onPlayFromQueue: () => onPlayFrom(index),
          onMoveToNext: canMoveToNext ? () => onReorder(index, 1) : undefined,
          onMoveToEnd: canMoveToEnd ? () => onReorder(index, queue.length - 1) : undefined,
        },
      });
    },
    [openMenu, onPlayFrom, onRemove, onReorder, queue.length],
  );

  const handleToggleSelect = useCallback((index: number, shiftKey: boolean) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);

      if (shiftKey && lastSelectedIndex !== null) {

        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          if (i !== 0) {
            newSet.add(i);
          }
        }
      } else {

        if (index !== 0) {
          if (newSet.has(index)) {
            newSet.delete(index);
          } else {
            newSet.add(index);
          }
        }
      }

      return newSet;
    });

    if (!shiftKey || lastSelectedIndex === null) {
      setLastSelectedIndex(index);
    }
  }, [lastSelectedIndex]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;

    const sortedIndices = Array.from(selectedIndices).sort((a, b) => b - a);

    sortedIndices.forEach(index => {
      onRemove(index);
    });

    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
    showToast(`Removed ${sortedIndices.length} track${sortedIndices.length === 1 ? '' : 's'} from queue`, 'success');
  }, [selectedIndices, onRemove, showToast]);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
  }, []);

  const handleSmartTracksAction = useCallback(
    async (action: "add" | "refresh") => {
      try {
        if (action === "refresh") {
          if (!onRefreshSmartTracks) {
            showToast("Smart queue refresh is not available yet", "warning");
            return;
          }
          await onRefreshSmartTracks();
          showToast("Smart tracks refreshed", "success");
          return;
        }

        if (!onAddSmartTracks) {
          showToast("Smart queue is not available yet", "warning");
          return;
        }

        const added = await onAddSmartTracks();
        if (added.length === 0) {
          showToast("No smart tracks found for this song", "info");
        } else {
          showToast(`Added ${added.length} smart track${added.length === 1 ? "" : "s"}`, "success");
        }
      } catch (error) {
        console.error("[EnhancedQueue] Smart tracks action failed:", error);
        showToast("Failed to update smart tracks", "error");
      }
    },
    [onAddSmartTracks, onRefreshSmartTracks, showToast],
  );

  const handleApplySettings = useCallback(
    async (settings: { count: number; similarityLevel: SimilarityPreference }) => {
      if (!onAddSmartTracks) {
        showToast("Smart queue is not available yet", "warning");
        return;
      }

      try {
        setSmartTracksCount(settings.count);
        setSimilarityLevel(settings.similarityLevel);
        const added = await onAddSmartTracks({
          count: settings.count,
          similarityLevel: settings.similarityLevel,
        });
        if (added.length === 0) {
          showToast("No smart tracks found for this song", "info");
        } else {
          showToast(`Added ${added.length} smart track${added.length === 1 ? "" : "s"}`, "success");
        }
      } catch (error) {
        console.error("[EnhancedQueue] Failed to add smart tracks with custom settings:", error);
        showToast("Failed to add smart tracks", "error");
      }
    },
    [onAddSmartTracks, showToast],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!queueListRef.current?.contains(document.activeElement)) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();

        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const currentIndex = lastSelectedIndex ?? 0;
        const newIndex = Math.max(0, Math.min(queue.length - 1, currentIndex + direction));

        handleToggleSelect(newIndex, e.shiftKey);
      } else if (e.key === 'Escape') {
        handleClearSelection();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndices.size > 0) {
        e.preventDefault();
        handleRemoveSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queue.length, lastSelectedIndex, selectedIndices, handleToggleSelect, handleClearSelection, handleRemoveSelected]);

  const totalDuration = queue.reduce((acc, track) => acc + track.duration, 0);

  return (
    <div className="theme-chrome-drawer fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l backdrop-blur-lg">
      { }
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              Queue ({queue.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {queuedTracks.length > 0 && (
              <>
                <button
                  onClick={() =>
                    handleSmartTracksAction(
                      smartQueueState.isActive ? "refresh" : "add",
                    )
                  }
                  disabled={smartQueueState.isLoading}
                  className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[rgba(88,198,177,0.12)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={
                    smartQueueState.isActive
                      ? "Refresh smart tracks"
                      : "Add smart tracks"
                  }
                  title={
                    smartQueueState.isActive
                      ? "Refresh smart tracks"
                      : "Add smart tracks"
                  }
                >
                  {smartQueueState.isLoading ? (
                    <LoadingSpinner size="sm" label="Loading smart tracks" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="hidden rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)] md:flex"
                  aria-label="Smart tracks settings"
                  title="Smart tracks settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </>
            )}
            {onSaveAsPlaylist && (queue.length > 0 || currentTrack) && (
              <button
                onClick={onSaveAsPlaylist}
                className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)]"
                aria-label="Save as playlist"
                title="Save as playlist"
              >
                <Save className="h-5 w-5" />
              </button>
            )}
            {queue.length > 0 && (
              <button
                onClick={onClear}
                className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[rgba(242,139,130,0.12)] hover:text-[var(--color-text)]"
                aria-label="Clear queue"
                title="Clear queue"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)]"
              aria-label="Close queue"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        { }
        {selectedIndices.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-[rgba(88,198,177,0.25)] bg-[rgba(88,198,177,0.12)] p-3">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {selectedIndices.size} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={handleRemoveSelected}
              className="flex items-center gap-2 rounded-lg bg-[rgba(248,139,130,0.2)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[rgba(248,139,130,0.3)]"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
            <button
              onClick={handleClearSelection}
              className="rounded-lg bg-[rgba(255,255,255,0.1)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.15)]"
            >
              Clear
            </button>
          </div>
        )}

        { }
        {queue.length > 0 && (
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Search queue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="theme-input w-full rounded-lg py-2 pr-4 pl-10 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        { }
        {

        }

        { }
        {

        }
      </div>

      { }
      <div
        ref={queueListRef}
        className="flex-1 overflow-y-auto overscroll-contain scroll-smooth pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mr-1 [&::-webkit-scrollbar-thumb]:bg-[rgba(88,198,177,0.3)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[rgba(88,198,177,0.5)] [&::-webkit-scrollbar-thumb]:transition-colors"
        id="queue-list"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(88, 198, 177, 0.3) transparent'
        }}
      >
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[var(--color-subtext)]">
            <div className="mb-4 text-6xl">🎵</div>
            <p className="mb-2 text-lg font-medium text-[var(--color-text)]">
              Queue is empty
            </p>
            <p className="text-sm">Add tracks to start building your queue</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[var(--color-subtext)]">
            <Search className="mb-4 h-12 w-12" />
            <p className="mb-2 text-lg font-medium text-[var(--color-text)]">
              No results found
            </p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredQueue.map((entry) => entry.sortableId)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                { }
                {filteredNowPlaying && (
                  <div className="border-b border-[rgba(255,255,255,0.05)]">
                    <div className="px-3 py-2 text-xs font-semibold text-[var(--color-subtext)] uppercase tracking-wider bg-[rgba(245,241,232,0.02)]">
                      Now Playing
                    </div>
                    <div key={filteredNowPlaying.sortableId} data-track-id={filteredNowPlaying.track.id}>
                      <SortableQueueItem
                        sortableId={filteredNowPlaying.sortableId}
                        track={filteredNowPlaying.track}
                        index={filteredNowPlaying.index}
                        isActive={currentTrack?.id === filteredNowPlaying.track.id}
                        isSelected={selectedIndices.has(filteredNowPlaying.index)}
                        onPlay={() => onPlayFrom(filteredNowPlaying.index)}
                        onRemove={() => onRemove(filteredNowPlaying.index)}
                        onToggleSelect={(e) => handleToggleSelect(filteredNowPlaying.index, e.shiftKey)}
                        onContextMenu={(e) => handleTrackContextMenu(filteredNowPlaying.track, filteredNowPlaying.index, e)}
                        isSmartTrack={filteredNowPlaying.isSmartTrack}
                        smartQueueMetadata={filteredNowPlaying.smartQueueMetadata}
                        seedTrackName={filteredNowPlaying.seedTrackName}
                        canRemove={filteredNowPlaying.index !== 0}
                      />
                    </div>
                  </div>
                )}

                { }
                {filteredUserTracks.length > 0 && (
                  <div className="border-b border-[rgba(255,255,255,0.05)]">
                    <div className="px-3 py-2 text-xs font-semibold text-[var(--color-subtext)] uppercase tracking-wider border-b border-[rgba(245,241,232,0.05)]">
                      Next in queue
                    </div>
                    <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                      {filteredUserTracks.map(({ track, index, sortableId, isSmartTrack, smartQueueMetadata, seedTrackName }) => (
                        <div key={sortableId} data-track-id={track.id}>
                          <SortableQueueItem
                            sortableId={sortableId}
                            track={track}
                            index={index}
                            isActive={currentTrack?.id === track.id}
                            isSelected={selectedIndices.has(index)}
                            onPlay={() => onPlayFrom(index)}
                            onRemove={() => onRemove(index)}
                            onToggleSelect={(e) => handleToggleSelect(index, e.shiftKey)}
                            onContextMenu={(e) => handleTrackContextMenu(track, index, e)}
                            isSmartTrack={isSmartTrack}
                            smartQueueMetadata={smartQueueMetadata}
                            seedTrackName={seedTrackName}
                            canRemove={index !== 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                { }
                {(filteredSmartTracks.length > 0 || smartQueueState.isLoading) && (
                  <div className="border-b border-[rgba(255,255,255,0.05)]">
                    <div className="px-3 py-2 text-xs font-semibold text-[var(--color-subtext)] uppercase tracking-wider border-b border-[rgba(245,241,232,0.05)] flex items-center gap-2">
                      <span>Smart tracks</span>
                      {smartQueueState.isLoading && (
                        <LoadingSpinner size="sm" label="Loading smart tracks" />
                      )}
                    </div>
                    {smartQueueState.isLoading && filteredSmartTracks.length === 0 ? (
                      <div className="px-3 py-4 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <LoadingSpinner size="md" label="Loading smart tracks" />
                          <p className="text-xs text-[var(--color-subtext)]">
                            Finding similar tracks...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                        {filteredSmartTracks.map(({ track, index, sortableId, isSmartTrack, smartQueueMetadata, seedTrackName }) => (
                          <div key={sortableId} data-track-id={track.id}>
                            <SortableQueueItem
                              sortableId={sortableId}
                              track={track}
                              index={index}
                              isActive={currentTrack?.id === track.id}
                              isSelected={selectedIndices.has(index)}
                              onPlay={() => onPlayFrom(index)}
                              onRemove={() => onRemove(index)}
                              onToggleSelect={(e) => handleToggleSelect(index, e.shiftKey)}
                              onContextMenu={(e) => handleTrackContextMenu(track, index, e)}
                              isSmartTrack={isSmartTrack}
                              smartQueueMetadata={smartQueueMetadata}
                              seedTrackName={seedTrackName}
                              canRemove={index !== 0}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      { }
      {queue.length > 0 && (
        <div className="border-t border-[var(--color-border)] p-4 text-sm text-[var(--color-subtext)]">
          <div className="flex items-center justify-between">
            <span>Total duration:</span>
            <span className="font-medium">{formatDuration(totalDuration)}</span>
          </div>
          {searchQuery && filteredQueue.length !== queue.length && (
            <div className="mt-2 text-xs text-[var(--color-muted)]">
              Showing {filteredQueue.length} of {queue.length} tracks
            </div>
          )}
          {!searchQuery && selectedIndices.size === 0 && (
            <div className="mt-2 text-xs text-[var(--color-muted)]">
              Tip: Click to select • Shift+Arrow to multi-select • Del/Backspace to remove
            </div>
          )}
        </div>
      )}

      {showSettingsModal && (
        <QueueSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onApply={handleApplySettings}
          initialCount={smartTracksCount}
          initialSimilarityLevel={similarityLevel}
        />
      )}
    </div>
  );
}
