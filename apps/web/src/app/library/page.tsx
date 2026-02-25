// File: apps/web/src/app/library/page.tsx

"use client";

import { EmptyState } from "@/components/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { hapticLight } from "@/utils/haptics";
import { getCoverImage } from "@/utils/images";
import { formatDuration } from "@/utils/time";
import { api } from "@starchild/api-client/trpc/react";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";
import { LoadingState } from "@starchild/ui/LoadingSpinner";
import {
  ArrowUpDown,
  CheckSquare,
  Clock,
  Heart,
  ListPlus,
  MoreHorizontal,
  Play,
  RotateCcw,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

type TabType = "favorites" | "history";
type SortOption = "newest" | "oldest" | "artist" | "album" | "duration";

type LibraryEntry = {
  id: number;
  track: Track;
  createdAt?: Date | string;
  playedAt?: Date | string;
  duration?: number | null;
};

type RemovalUndoState = {
  tab: TabType;
  entries: LibraryEntry[];
  timerId: number;
};

type LibraryGridCardProps = {
  entry: LibraryEntry;
  entryLabel: string;
  isFavorite: boolean;
  isFavoritePending: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenuAtPoint: (x: number, y: number) => void;
};

type LibraryHeaderMenuAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

const UNDO_TIMEOUT_MS = 8000;
const SMART_SEED_LIMIT = 5;
const SMART_QUEUE_LIMIT = 40;
const BULK_MUTATION_CONCURRENCY = 8;
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "duration", label: "Duration" },
];

function shuffleTracks(tracks: Track[]): Track[] {
  const copy = [...tracks];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex]!;
    copy[swapIndex] = current!;
  }
  return copy;
}

function createTrackSearchText(track: Track): string {
  return `${track.title} ${track.artist.name} ${track.album.title}`.toLowerCase();
}

function dedupeTracksById(tracks: Track[]): Track[] {
  const seenTrackIds = new Set<number>();
  const uniqueTracks: Track[] = [];

  for (const track of tracks) {
    if (seenTrackIds.has(track.id)) {
      continue;
    }

    seenTrackIds.add(track.id);
    uniqueTracks.push(track);
  }

  return uniqueTracks;
}

function buildLibraryPlaylistName(tab: TabType): string {
  const date = new Date().toISOString().slice(0, 10);
  const section = tab === "favorites" ? "Favorites" : "Recent";
  return `Library ${section} ${date}`;
}

function getEntryTimestamp(entry: LibraryEntry): number {
  const value = entry.createdAt ?? entry.playedAt;
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEntryLabel(entry: LibraryEntry, tab: TabType): string {
  const value = tab === "history" ? entry.playedAt : entry.createdAt;
  if (!value) {
    return tab === "history" ? "Recently played" : "Saved track";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return tab === "history" ? "Recently played" : "Saved track";
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return tab === "history" ? `Played ${dateLabel}` : `Saved ${dateLabel}`;
}

function sortLibraryEntries(
  entries: LibraryEntry[],
  sortOption: SortOption,
): LibraryEntry[] {
  const copy = [...entries];

  copy.sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return getEntryTimestamp(b) - getEntryTimestamp(a);
      case "oldest":
        return getEntryTimestamp(a) - getEntryTimestamp(b);
      case "artist":
        return a.track.artist.name.localeCompare(
          b.track.artist.name,
          undefined,
          {
            sensitivity: "base",
          },
        );
      case "album":
        return a.track.album.title.localeCompare(
          b.track.album.title,
          undefined,
          {
            sensitivity: "base",
          },
        );
      case "duration":
        return (b.track.duration ?? 0) - (a.track.duration ?? 0);
      default:
        return 0;
    }
  });

  return copy;
}

type ConcurrentTaskResult<TItem, TValue> =
  | { item: TItem; status: "fulfilled"; value: TValue }
  | { item: TItem; status: "rejected"; reason: unknown };

function isConcurrentTaskFulfilled<TItem, TValue>(
  result: ConcurrentTaskResult<TItem, TValue>,
): result is { item: TItem; status: "fulfilled"; value: TValue } {
  return result.status === "fulfilled";
}

async function mapWithConcurrency<TItem, TValue>(
  items: readonly TItem[],
  task: (item: TItem) => Promise<TValue>,
  concurrency = BULK_MUTATION_CONCURRENCY,
): Promise<Array<ConcurrentTaskResult<TItem, TValue>>> {
  if (items.length === 0) {
    return [];
  }

  const batchSize = Math.max(1, Math.min(concurrency, items.length));
  const results: Array<ConcurrentTaskResult<TItem, TValue>> = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (item) => ({ item, value: await task(item) })),
    );

    settled.forEach((result, index) => {
      const item = batch[index];
      if (item === undefined) {
        return;
      }

      if (result.status === "fulfilled") {
        results.push({
          item,
          status: "fulfilled",
          value: result.value.value,
        });
        return;
      }

      results.push({
        item,
        status: "rejected",
        reason: result.reason,
      });
    });
  }

  return results;
}

function LibraryHeaderActionMenu({
  actions,
}: {
  actions: LibraryHeaderMenuAction[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-subtext)] transition-all duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35 focus-visible:outline-none"
          aria-label="Open additional library actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-20 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl"
      >
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onSelect={() => {
              if (!action.disabled) {
                action.onSelect();
              }
            }}
            disabled={action.disabled}
            className={`gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 ease-out ${
              action.tone === "danger"
                ? "text-[var(--color-danger)] focus:bg-[var(--color-danger)]/12"
                : "text-[var(--color-subtext)] focus:bg-[var(--color-surface-hover)] focus:text-[var(--color-text)]"
            }`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              {action.icon}
            </span>
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LibraryGridCard({
  entry,
  entryLabel,
  isFavorite,
  isFavoritePending,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onPlay,
  onToggleFavorite,
  onOpenMenu,
  onOpenMenuAtPoint,
}: LibraryGridCardProps) {
  const cardActionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-all duration-200 ease-out hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50";
  const mobileActionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-subtext)] transition-all duration-200 ease-out hover:bg-white/10 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-[var(--color-surface)] transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-[var(--color-accent)]/35 ${
        isSelected
          ? "border-[var(--color-accent)] shadow-lg shadow-[rgba(88,198,177,0.18)]"
          : "border-[var(--color-border)] hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40 hover:shadow-xl"
      }`}
      tabIndex={0}
      aria-label={`${entry.track.title} by ${entry.track.artist.name}`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (isSelectionMode) {
            onToggleSelection();
          } else {
            onPlay();
          }
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenuAtPoint(event.clientX, event.clientY);
      }}
    >
      <div className="relative aspect-video overflow-hidden border-b border-[var(--color-border)]/65 bg-black/30">
        <Image
          src={getCoverImage(entry.track, "medium")}
          alt={`${entry.track.album.title} cover`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, (max-width: 1536px) 33vw, 25vw"
          className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/20 transition-colors duration-200 ease-out group-hover:bg-black/40 md:bg-transparent md:group-focus-within:bg-black/40 md:group-hover:bg-black/40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

        {isSelectionMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelection();
            }}
            className="absolute top-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/65 text-white transition-colors duration-200 ease-out hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            aria-pressed={isSelected}
            aria-label={isSelected ? "Deselect track" : "Select track"}
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        ) : null}

        {!isSelectionMode ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden p-2 md:block">
            <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/20 bg-black/60 p-1 backdrop-blur-sm transition-all duration-200 ease-out md:translate-y-1.5 md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:translate-y-0 md:group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPlay();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-emerald-950 transition-colors duration-200 ease-out hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:outline-none"
                aria-label={`Play ${entry.track.title}`}
              >
                <Play className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite();
                }}
                className={cardActionButtonClass}
                aria-label={
                  isFavorite
                    ? `Remove ${entry.track.title} from favorites`
                    : `Add ${entry.track.title} to favorites`
                }
                aria-pressed={isFavorite}
                disabled={isFavoritePending}
              >
                <Heart
                  className={`h-4 w-4 ${isFavorite ? "fill-current text-rose-300" : ""}`}
                />
              </button>

              <button
                type="button"
                onClick={onOpenMenu}
                className={`${cardActionButtonClass} ml-auto`}
                aria-label={`Open actions for ${entry.track.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
          {entry.track.title}
        </h3>
        <p className="line-clamp-1 text-sm text-[var(--color-subtext)]">
          {entry.track.artist.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-[var(--color-muted)]">
          <span className="line-clamp-1">{entryLabel}</span>
          <span className="shrink-0 tabular-nums">
            {formatDuration(entry.track.duration ?? 0)}
          </span>
        </div>
      </div>

      {!isSelectionMode ? (
        <div className="flex items-center gap-1 border-t border-[var(--color-border)]/60 bg-black/10 p-2 md:hidden">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-emerald-950 transition-colors duration-200 ease-out hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:outline-none"
            aria-label={`Play ${entry.track.title}`}
          >
            <Play className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className={mobileActionButtonClass}
            aria-label={
              isFavorite
                ? `Remove ${entry.track.title} from favorites`
                : `Add ${entry.track.title} to favorites`
            }
            aria-pressed={isFavorite}
            disabled={isFavoritePending}
          >
            <Heart
              className={`h-4 w-4 ${isFavorite ? "fill-current text-rose-400" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={onOpenMenu}
            className={`${mobileActionButtonClass} ml-auto`}
            aria-label={`Open actions for ${entry.track.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabType>("favorites");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(
    new Set(),
  );
  const [removalUndo, setRemovalUndo] = useState<RemovalUndoState | null>(null);
  const [isListActionPending, setIsListActionPending] = useState(false);
  const [favoritePendingTrackIds, setFavoritePendingTrackIds] = useState<
    Set<number>
  >(new Set());

  const sessionState = useSession();
  const isAuthenticated = sessionState.status === "authenticated";

  const { showToast } = useToast();
  const { openMenu } = useTrackContextMenu();
  const player = useGlobalPlayer();
  const utils = api.useUtils();

  const { data: favorites, isLoading: favoritesLoading } =
    api.music.getFavorites.useQuery(
      { limit: 100, offset: 0 },
      { enabled: isAuthenticated },
    );

  const { data: history, isLoading: historyLoading } =
    api.music.getHistory.useQuery(
      { limit: 100, offset: 0 },
      { enabled: activeTab === "history" && isAuthenticated },
    );

  const addFavorite = api.music.addFavorite.useMutation();
  const removeFavorite = api.music.removeFavorite.useMutation();
  const addToHistory = api.music.addToHistory.useMutation();
  const removeFromHistory = api.music.removeFromHistory.useMutation();
  const clearHistory = api.music.clearHistory.useMutation();
  const clearNonFavoritesFromHistory =
    api.music.clearNonFavoritesFromHistory.useMutation();
  const createPlaylist = api.music.createPlaylist.useMutation();
  const addToPlaylist = api.music.addToPlaylist.useMutation();
  const generateSmartMix = api.music.generateSmartMix.useMutation();

  const favoriteEntries = useMemo(
    () => (favorites ?? []) as LibraryEntry[],
    [favorites],
  );
  const historyEntries = useMemo(
    () => (history ?? []) as LibraryEntry[],
    [history],
  );
  const favoriteTrackIds = useMemo(
    () => new Set(favoriteEntries.map((entry) => entry.track.id)),
    [favoriteEntries],
  );

  const activeEntries =
    activeTab === "favorites" ? favoriteEntries : historyEntries;
  const activeTracks = activeEntries.map((entry) => entry.track);
  const activeTabLoading =
    activeTab === "favorites" ? favoritesLoading : historyLoading;

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasSearchFilter = normalizedSearchQuery.length > 0;

  const sortedEntries = useMemo(
    () => sortLibraryEntries(activeEntries, sortOption),
    [activeEntries, sortOption],
  );

  const visibleEntries = useMemo(() => {
    if (!hasSearchFilter) return sortedEntries;
    return sortedEntries.filter((entry) =>
      createTrackSearchText(entry.track).includes(normalizedSearchQuery),
    );
  }, [hasSearchFilter, normalizedSearchQuery, sortedEntries]);

  const visibleTracks = useMemo(
    () => visibleEntries.map((entry) => entry.track),
    [visibleEntries],
  );

  const selectedEntries = useMemo(
    () => activeEntries.filter((entry) => selectedEntryIds.has(entry.id)),
    [activeEntries, selectedEntryIds],
  );

  const selectedTracks = useMemo(
    () => selectedEntries.map((entry) => entry.track),
    [selectedEntries],
  );

  const selectedVisibleCount = useMemo(
    () =>
      visibleEntries.filter((entry) => selectedEntryIds.has(entry.id)).length,
    [selectedEntryIds, visibleEntries],
  );

  useEffect(() => {
    return () => {
      if (removalUndo) {
        window.clearTimeout(removalUndo.timerId);
      }
    };
  }, [removalUndo]);

  useEffect(() => {
    setSelectedEntryIds((previous) => {
      if (previous.size === 0) return previous;

      const availableIds = new Set(activeEntries.map((entry) => entry.id));
      let changed = false;
      const next = new Set<number>();

      for (const id of previous) {
        if (availableIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [activeEntries]);

  const setFavoriteTrackPending = (trackId: number, pending: boolean): void => {
    setFavoritePendingTrackIds((previous) => {
      const next = new Set(previous);
      if (pending) {
        next.add(trackId);
      } else {
        next.delete(trackId);
      }
      return next;
    });
  };

  const playTrackList = (tracks: Track[]): void => {
    if (tracks.length === 0) return;

    const [first, ...rest] = tracks;
    if (!first) return;

    hapticLight();
    player.clearQueue();
    player.playTrack(first);
    if (rest.length > 0) {
      player.addToQueue(rest, false);
    }
  };

  const clearSelection = (): void => {
    setSelectedEntryIds(new Set());
  };

  const switchTab = (tab: TabType): void => {
    setSearchQuery("");
    setIsSelectionMode(false);
    clearSelection();
    setActiveTab(tab);
  };

  const handlePlayAll = (): void => {
    playTrackList(visibleTracks);
  };

  const handleShuffleAll = (): void => {
    playTrackList(shuffleTracks(visibleTracks));
  };

  const handleQueueAllNext = (): void => {
    if (visibleTracks.length === 0) return;
    hapticLight();
    player.addToPlayNext(visibleTracks);
  };

  const handlePlayFromHere = (index: number): void => {
    if (index < 0 || index >= visibleTracks.length) return;
    playTrackList(visibleTracks.slice(index));
  };

  const handleToggleSelectionMode = (): void => {
    setIsSelectionMode((previous) => {
      if (previous) {
        clearSelection();
      }
      return !previous;
    });
  };

  const handleToggleEntrySelection = (entryId: number): void => {
    setSelectedEntryIds((previous) => {
      const next = new Set(previous);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleSelectAllInTab = (): void => {
    const entriesToSelect = hasSearchFilter ? visibleEntries : activeEntries;
    setSelectedEntryIds(new Set(entriesToSelect.map((entry) => entry.id)));
  };

  const handlePlaySelected = (): void => {
    playTrackList(selectedTracks);
  };

  const handleQueueSelected = (): void => {
    if (selectedTracks.length === 0) return;
    hapticLight();
    player.addToPlayNext(selectedTracks);
  };

  const handleSaveTabAsPlaylist = async (): Promise<void> => {
    if (isListActionPending) {
      return;
    }

    const sourceTracks = dedupeTracksById(
      selectedTracks.length > 0 ? selectedTracks : visibleTracks,
    );

    if (sourceTracks.length === 0) {
      showToast("No tracks available to save as a playlist", "info");
      return;
    }

    setIsListActionPending(true);

    try {
      const sourceLabel =
        selectedTracks.length > 0
          ? "selected tracks"
          : hasSearchFilter
            ? "filtered tab"
            : "library tab";

      const playlist = await createPlaylist.mutateAsync({
        name: buildLibraryPlaylistName(activeTab),
        description: `Generated from your ${sourceLabel}`,
        isPublic: false,
      });

      if (!playlist) {
        throw new Error("Playlist creation failed");
      }

      const results = await mapWithConcurrency(sourceTracks, (track) =>
        addToPlaylist.mutateAsync({
          playlistId: playlist.id,
          track,
        }),
      );

      const successfulResults = results.filter(isConcurrentTaskFulfilled);
      const failedCount = results.length - successfulResults.length;
      const addedCount = successfulResults.reduce((count, result) => {
        return result.value.alreadyExists ? count : count + 1;
      }, 0);

      await utils.music.getPlaylists.invalidate();

      if (failedCount > 0) {
        showToast(
          `Saved ${addedCount} track${addedCount === 1 ? "" : "s"} to "${
            playlist.name
          }" (${failedCount} failed to add)`,
          "warning",
        );
      } else {
        showToast(
          `Saved ${addedCount} track${addedCount === 1 ? "" : "s"} to "${playlist.name}"`,
          "success",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to save playlist: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleSmartQueueFromLibrary = async (): Promise<void> => {
    if (isListActionPending) {
      return;
    }

    const sourceTracks = dedupeTracksById(
      selectedTracks.length > 0 ? selectedTracks : visibleTracks,
    );

    if (sourceTracks.length === 0) {
      showToast("No tracks available to build smart queue", "info");
      return;
    }

    const seedTracks = sourceTracks.slice(0, SMART_SEED_LIMIT);
    const seedTrackIds = seedTracks.map((track) => track.id);

    setIsListActionPending(true);

    try {
      const mix = await generateSmartMix.mutateAsync({
        seedTrackIds,
        limit: SMART_QUEUE_LIMIT,
        diversity: "balanced",
        recommendationSource: "unified",
      });

      const seedTrackIdSet = new Set(seedTrackIds);
      const recommendedTracks = dedupeTracksById(mix.tracks).filter(
        (track) => !seedTrackIdSet.has(track.id),
      );

      playTrackList([...seedTracks, ...recommendedTracks]);

      showToast(
        `Smart queue ready: ${seedTracks.length} seeds + ${recommendedTracks.length} recommendations`,
        "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to build smart queue: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleClearHistory = async (): Promise<void> => {
    if (isListActionPending || activeTab !== "history") {
      return;
    }

    if (
      !window.confirm(
        "Clear your full listening history? This cannot be undone.",
      )
    ) {
      return;
    }

    setIsListActionPending(true);

    try {
      const result = await clearHistory.mutateAsync();
      await utils.music.getHistory.invalidate();
      clearSelection();

      if (removalUndo) {
        window.clearTimeout(removalUndo.timerId);
        setRemovalUndo(null);
      }

      showToast(
        `Cleared ${result.removedCount} history entr${
          result.removedCount === 1 ? "y" : "ies"
        }`,
        "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to clear history: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleClearNonFavoritesHistory = async (): Promise<void> => {
    if (isListActionPending || activeTab !== "history") {
      return;
    }

    if (
      !window.confirm(
        "Remove all non-favorite tracks from history? Favorite history entries will be kept.",
      )
    ) {
      return;
    }

    setIsListActionPending(true);

    try {
      const result = await clearNonFavoritesFromHistory.mutateAsync();
      await utils.music.getHistory.invalidate();
      clearSelection();

      if (removalUndo) {
        window.clearTimeout(removalUndo.timerId);
        setRemovalUndo(null);
      }

      showToast(
        `Removed ${result.removedCount} non-favorite history ${
          result.removedCount === 1 ? "entry" : "entries"
        }`,
        "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to clear non-favorites: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleRemoveEntries = async (
    entries: LibraryEntry[],
  ): Promise<void> => {
    if (entries.length === 0 || isListActionPending) {
      return;
    }

    const tabForRemoval = activeTab;
    setIsListActionPending(true);

    try {
      const removalResults =
        tabForRemoval === "favorites"
          ? await mapWithConcurrency(entries, (entry) =>
              removeFavorite.mutateAsync({ trackId: entry.track.id }),
            )
          : await mapWithConcurrency(entries, (entry) =>
              removeFromHistory.mutateAsync({ historyId: entry.id }),
            );

      const removedEntries = removalResults
        .filter(isConcurrentTaskFulfilled)
        .map((result) => result.item);
      const failedCount = removalResults.length - removedEntries.length;

      if (removedEntries.length === 0) {
        showToast("Failed to remove tracks", "error");
        return;
      }

      if (tabForRemoval === "favorites") {
        await utils.music.getFavorites.invalidate();
      } else {
        await utils.music.getHistory.invalidate();
      }

      setSelectedEntryIds((previous) => {
        if (previous.size === 0) return previous;

        const next = new Set(previous);
        removedEntries.forEach((entry) => {
          next.delete(entry.id);
        });
        return next;
      });

      if (removalUndo) {
        window.clearTimeout(removalUndo.timerId);
      }

      const timerId = window.setTimeout(() => {
        setRemovalUndo(null);
      }, UNDO_TIMEOUT_MS);

      setRemovalUndo({
        tab: tabForRemoval,
        entries: [...removedEntries],
        timerId,
      });

      const targetLabel =
        tabForRemoval === "favorites" ? "favorites" : "history";
      if (failedCount > 0) {
        showToast(
          `Removed ${removedEntries.length} track${
            removedEntries.length === 1 ? "" : "s"
          } from ${targetLabel} (${failedCount} failed to remove)`,
          "warning",
        );
      } else {
        showToast(
          `Removed ${removedEntries.length} track${
            removedEntries.length === 1 ? "" : "s"
          } from ${targetLabel}`,
          "info",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to remove tracks: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleRemoveSelected = (): void => {
    void handleRemoveEntries(selectedEntries);
  };

  const handleUndoRemoval = async (): Promise<void> => {
    if (!removalUndo || isListActionPending) {
      return;
    }

    const pendingUndo = removalUndo;
    setIsListActionPending(true);

    try {
      window.clearTimeout(pendingUndo.timerId);

      const restoreResults =
        pendingUndo.tab === "favorites"
          ? await mapWithConcurrency(pendingUndo.entries, (entry) =>
              addFavorite.mutateAsync({ track: entry.track }),
            )
          : await mapWithConcurrency(pendingUndo.entries, (entry) =>
              addToHistory.mutateAsync({
                track: entry.track,
                duration: entry.duration ?? undefined,
              }),
            );

      const restoredEntries = restoreResults
        .filter(isConcurrentTaskFulfilled)
        .map((result) => result.item);
      const failedEntries = restoreResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.item);

      if (pendingUndo.tab === "favorites") {
        if (restoredEntries.length > 0) {
          await utils.music.getFavorites.invalidate();
        }
      } else if (restoredEntries.length > 0) {
        await utils.music.getHistory.invalidate();
      }

      if (failedEntries.length > 0) {
        const timerId = window.setTimeout(() => {
          setRemovalUndo(null);
        }, UNDO_TIMEOUT_MS);

        setRemovalUndo({
          tab: pendingUndo.tab,
          entries: failedEntries,
          timerId,
        });

        if (restoredEntries.length > 0) {
          showToast(
            `Restored ${restoredEntries.length} track${
              restoredEntries.length === 1 ? "" : "s"
            } (${failedEntries.length} failed to restore)`,
            "warning",
          );
        } else {
          showToast("Failed to restore tracks", "error");
        }
        return;
      }

      showToast(
        `Restored ${restoredEntries.length} track${
          restoredEntries.length === 1 ? "" : "s"
        }`,
        "success",
      );

      setRemovalUndo(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to restore tracks: ${message}`, "error");
    } finally {
      setIsListActionPending(false);
    }
  };

  const handleToggleFavoriteForEntry = async (
    entry: LibraryEntry,
  ): Promise<void> => {
    const trackId = entry.track.id;

    if (favoritePendingTrackIds.has(trackId)) {
      return;
    }

    setFavoriteTrackPending(trackId, true);

    try {
      if (activeTab === "favorites") {
        await handleRemoveEntries([entry]);
        return;
      }

      const isFavorite = favoriteTrackIds.has(trackId);

      if (isFavorite) {
        await removeFavorite.mutateAsync({ trackId });
        showToast(`Removed "${entry.track.title}" from favorites`, "info");
      } else {
        await addFavorite.mutateAsync({ track: entry.track });
        showToast(`Added "${entry.track.title}" to favorites`, "success");
      }

      await utils.music.getFavorites.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to update favorites: ${message}`, "error");
    } finally {
      setFavoriteTrackPending(trackId, false);
    }
  };

  const openEntryMenuAtPoint = (
    entry: LibraryEntry,
    x: number,
    y: number,
  ): void => {
    const removeLabel =
      activeTab === "favorites"
        ? "Remove from Favorites"
        : "Remove from Recently Played";

    hapticLight();
    openMenu(entry.track, x, y, {
      removeFromList: {
        label: removeLabel,
        onRemove: () => {
          void handleRemoveEntries([entry]);
        },
      },
    });
  };

  const handleOpenEntryMenu = (
    entry: LibraryEntry,
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    openEntryMenuAtPoint(entry, rect.right, rect.bottom);
  };

  const isActionDisabled = isListActionPending || activeTabLoading;
  const hasVisibleTracks = visibleTracks.length > 0;
  const selectionScopeLabel = hasSearchFilter ? "Select Visible" : "Select All";
  const selectableEntryCount = hasSearchFilter
    ? visibleEntries.length
    : activeEntries.length;
  const sectionLabel = activeTab === "favorites" ? "Favorites" : "Recent";
  const searchPlaceholder = `Search ${sectionLabel.toLowerCase()}...`;
  const headerMenuActions: LibraryHeaderMenuAction[] = [
    {
      key: "save-playlist",
      label: "Save as Playlist",
      icon: <Save className="h-3.5 w-3.5" />,
      onSelect: () => {
        void handleSaveTabAsPlaylist();
      },
      disabled: isActionDisabled || !hasVisibleTracks,
    },
    {
      key: "smart-queue",
      label: "Build Smart Queue",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      onSelect: () => {
        void handleSmartQueueFromLibrary();
      },
      disabled: isActionDisabled || !hasVisibleTracks,
    },
  ];

  if (activeTab === "history") {
    headerMenuActions.push({
      key: "clear-non-favorites",
      label: "Clear Non-Favorites",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onSelect: () => {
        void handleClearNonFavoritesHistory();
      },
      disabled: isActionDisabled,
    });
    headerMenuActions.push({
      key: "clear-history",
      label: "Clear Full History",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onSelect: () => {
        void handleClearHistory();
      },
      disabled: isActionDisabled,
      tone: "danger",
    });
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col px-3 py-4 md:px-6 md:py-8">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-text)] md:mb-8 md:text-3xl">
          Your Library
        </h1>

        <div className="fade-in">
          <EmptyState
            icon={<Heart className="h-12 w-12 md:h-16 md:w-16" />}
            title="Sign in to view your library"
            description="Favorites and listening history are available after login."
            action={
              <Link href="/signin" className="btn-primary touch-target-lg">
                Sign in
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen flex-col px-3 py-4 md:px-6 md:py-8">
      <header className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:mb-7 md:p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase">
                  Your Music
                </p>
                <h1 className="text-2xl font-bold text-[var(--color-text)] md:text-3xl">
                  Your Library
                </h1>
              </div>

              <nav
                aria-label="Library sections"
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => switchTab("favorites")}
                  className={`touch-target inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-all duration-200 ease-out ${
                    activeTab === "favorites"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-subtext)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                  }`}
                  aria-pressed={activeTab === "favorites"}
                >
                  Favorites
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("history")}
                  className={`touch-target inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-all duration-200 ease-out ${
                    activeTab === "history"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-subtext)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                  }`}
                  aria-pressed={activeTab === "history"}
                >
                  Recent
                </button>
                <Link
                  href="/playlists"
                  className="touch-target inline-flex h-9 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm font-medium text-[var(--color-subtext)] transition-all duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                >
                  Playlists
                </Link>
              </nav>
            </div>

            <div className="w-full lg:max-w-[34rem]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block w-full">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-subtext)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pr-3 pl-9 text-sm text-[var(--color-text)] transition-colors duration-200 ease-out outline-none focus:border-[var(--color-accent)]"
                    aria-label="Search library tracks"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePlayAll}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 transition-all duration-200 ease-out hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[170px]"
                  disabled={!hasVisibleTracks || isActionDisabled}
                >
                  <Play className="h-4 w-4" />
                  <span>Play All</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[150px]">
              <ArrowUpDown className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-subtext)]" />
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                className="h-9 w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1 pr-2 pl-8 text-xs text-[var(--color-text)] transition-colors duration-200 ease-out outline-none focus:border-[var(--color-accent)]"
                aria-label="Sort library"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleToggleSelectionMode}
              className="touch-target inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
            >
              {isSelectionMode ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Select</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShuffleAll}
              className="touch-target inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasVisibleTracks || isActionDisabled}
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Shuffle</span>
            </button>

            <button
              type="button"
              onClick={handleQueueAllNext}
              className="touch-target inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasVisibleTracks || isActionDisabled}
            >
              <ListPlus className="h-3.5 w-3.5" />
              <span>Queue Next</span>
            </button>

            <LibraryHeaderActionMenu actions={headerMenuActions} />
          </div>
        </div>

        <p className="mt-3 text-xs text-[var(--color-subtext)]">
          {visibleTracks.length} of {activeTracks.length} tracks shown in{" "}
          {sectionLabel.toLowerCase()}.
        </p>
      </header>

      {isSelectionMode ? (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 md:mb-6 md:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-subtext)]">
              {selectedEntries.length} selected
              {hasSearchFilter
                ? ` (${selectedVisibleCount} visible with current filter)`
                : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSelectAllInTab}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectableEntryCount === 0 || isActionDisabled}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>{selectionScopeLabel}</span>
              </button>

              <button
                onClick={clearSelection}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedEntries.length === 0 || isActionDisabled}
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>

              <button
                onClick={handlePlaySelected}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-950 transition-colors duration-200 ease-out hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedTracks.length === 0 || isActionDisabled}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Play Selected</span>
              </button>

              <button
                onClick={handleQueueSelected}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-subtext)] transition-colors duration-200 ease-out hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedTracks.length === 0 || isActionDisabled}
              >
                <ListPlus className="h-3.5 w-3.5" />
                <span>Queue Selected</span>
              </button>

              <button
                onClick={handleRemoveSelected}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-2 py-1 text-xs font-medium text-[var(--color-danger)] transition-colors duration-200 ease-out hover:bg-[var(--color-danger)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedEntries.length === 0 || isActionDisabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Selected</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removalUndo ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(244,178,102,0.22)] bg-[rgba(244,178,102,0.08)] px-3 py-2 text-sm text-[var(--color-text)] md:mb-6">
          <span>
            Removed {removalUndo.entries.length} track
            {removalUndo.entries.length === 1 ? "" : "s"}
          </span>

          <button
            onClick={() => {
              void handleUndoRemoval();
            }}
            className="inline-flex items-center gap-1 rounded-md bg-[rgba(88,198,177,0.18)] px-2 py-1 text-xs font-semibold text-[var(--color-text)] transition-colors duration-200 ease-out hover:bg-[rgba(88,198,177,0.28)]"
            disabled={isActionDisabled}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Undo</span>
          </button>
        </div>
      ) : null}

      <section className="fade-in">
        {!activeTabLoading && activeEntries.length > 0 ? (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {sectionLabel}
            </h2>
            <p className="text-xs text-[var(--color-subtext)]">
              {visibleTracks.length} track
              {visibleTracks.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        {activeTabLoading ? (
          <LoadingState
            message={
              activeTab === "favorites"
                ? "Loading your favorites..."
                : "Loading your recent tracks..."
            }
          />
        ) : activeEntries.length > 0 ? (
          visibleEntries.length > 0 ? (
            <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 md:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleEntries.map((entry, index) => {
                const trackId = entry.track.id;
                const isFavorite =
                  activeTab === "favorites" || favoriteTrackIds.has(trackId);

                return (
                  <LibraryGridCard
                    key={entry.id}
                    entry={entry}
                    entryLabel={formatEntryLabel(entry, activeTab)}
                    isFavorite={isFavorite}
                    isFavoritePending={favoritePendingTrackIds.has(trackId)}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedEntryIds.has(entry.id)}
                    onToggleSelection={() =>
                      handleToggleEntrySelection(entry.id)
                    }
                    onPlay={() => handlePlayFromHere(index)}
                    onToggleFavorite={() => {
                      void handleToggleFavoriteForEntry(entry);
                    }}
                    onOpenMenu={(event) => handleOpenEntryMenu(entry, event)}
                    onOpenMenuAtPoint={(x, y) =>
                      openEntryMenuAtPoint(entry, x, y)
                    }
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={
                activeTab === "favorites" ? (
                  <Heart className="h-12 w-12 md:h-16 md:w-16" />
                ) : (
                  <Clock className="h-12 w-12 md:h-16 md:w-16" />
                )
              }
              title={
                activeTab === "favorites"
                  ? "No favorites match your search"
                  : "No recent tracks match your search"
              }
              description="Try another search or clear the current filter."
              action={
                <button
                  onClick={() => setSearchQuery("")}
                  className="btn-primary touch-target-lg"
                >
                  Clear search
                </button>
              }
            />
          )
        ) : (
          <EmptyState
            icon={
              activeTab === "favorites" ? (
                <Heart className="h-12 w-12 md:h-16 md:w-16" />
              ) : (
                <Clock className="h-12 w-12 md:h-16 md:w-16" />
              )
            }
            title={
              activeTab === "favorites"
                ? "No favorites yet"
                : "No listening history yet"
            }
            description={
              activeTab === "favorites"
                ? "Tracks you favorite will appear here"
                : "Your recently played tracks will appear here"
            }
            action={
              <Link href="/" className="btn-primary touch-target-lg">
                {activeTab === "favorites"
                  ? "Search for music"
                  : "Start listening to music"}
              </Link>
            }
          />
        )}
      </section>

      {activeEntries.length >= 100 ? (
        <footer className="mt-6 flex justify-center">
          <p className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-subtext)]">
            Showing the latest 100 tracks in this section.
          </p>
        </footer>
      ) : null}
    </div>
  );
}
