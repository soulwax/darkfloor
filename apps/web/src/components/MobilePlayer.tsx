// File: apps/web/src/components/MobilePlayer.tsx

"use client";

import { LoadingSpinner } from "@starchild/ui";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { useAudioReactiveBackground } from "@/hooks/useAudioReactiveBackground";
import { api } from "@starchild/api-client/trpc/react";
import type { SimilarityPreference, Track } from "@starchild/types";
import {
  haptic,
  hapticLight,
  hapticMedium,
  hapticSliderContinuous,
  hapticSliderEnd,
  hapticSuccess,
} from "@/utils/haptics";
import { getCoverImage } from "@/utils/images";
import { settingsStorage } from "@/utils/settingsStorage";
import { springPresets } from "@/utils/spring-animations";
import { formatDuration, formatTime } from "@/utils/time";
import { MobilePlayerFooterActions } from "./MobilePlayerFooterActions";
import { getMobilePlayerDragDecision } from "./mobilePlayerDrag";
import {
  animate,
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  ArrowUp,
  ChevronDown,
  GripVertical,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Save,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  RotateCcw,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTranslations } from "next-intl";
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
  isSmartTrack?: boolean;
  onPlay: () => void;
  onPlayNext?: () => void;
  onRemove: () => void;
  onToggleSelect: (e: React.MouseEvent | React.TouchEvent) => void;
  onTouchEnd: () => void;
  canRemove: boolean;
  canPlayNext?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onReorder: (newIndex: number) => void;
}

function QueueItem({
  track,
  index,
  isActive,
  isSelected,
  isSmartTrack,
  onPlay,
  onPlayNext,
  onRemove,
  onToggleSelect,
  onTouchEnd,
  canRemove,
  canPlayNext = false,
  onDragStart,
  onDragEnd,
  isDragging,
  onReorder,
}: QueueItemProps) {
  const t = useTranslations("queue");
  const tc = useTranslations("common");
  const tm = useTranslations("trackMenu");
  const { openMenu } = useTrackContextMenu();
  const [dragY, setDragY] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const selectionStartYRef = useRef<number>(0);
  const isReorderingRef = useRef(false);
  const currentIndexRef = useRef<number>(index);

  useEffect(() => {
    currentIndexRef.current = index;
  }, [index]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      hapticLight();
      openMenu(track, event.clientX, event.clientY, {
        queueActions: {
          isQueued: true,
          onPlayFromQueue: onPlay,
          onMoveToNext: canPlayNext ? onPlayNext : undefined,
        },
        removeFromList: canRemove
          ? {
              label: t("removeFromQueueLabel"),
              onRemove,
            }
          : undefined,
      });
    },
    [canPlayNext, canRemove, onPlayNext, onPlay, onRemove, openMenu, t, track],
  );

  const coverImage = getCoverImage(track, "small");
  const altText = track.album?.title?.trim()?.length
    ? t("albumCoverArt", { album: track.album.title })
    : t("trackCoverArt", { title: track.title });

  const artistName = track.artist?.name?.trim()?.length
    ? track.artist.name
    : tc("unknownArtist");
  const albumTitle = track.album?.title?.trim()?.length
    ? track.album.title
    : null;

  const handleItemTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (touch) {
        selectionStartYRef.current = touch.clientY;
      }
    }
    onToggleSelect(e);
  };

  const handleItemTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && selectionStartYRef.current !== 0) {
      const touch = e.touches[0];
      if (touch) {
        const currentY = touch.clientY;
        const deltaY = currentY - selectionStartYRef.current;
        if (Math.abs(deltaY) > 8) {
          selectionStartYRef.current = 0;
          onTouchEnd();
        }
      }
    }
  };

  const handleItemTouchEnd = () => {
    selectionStartYRef.current = 0;
    onTouchEnd();
  };

  const handleReorderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (touch) {
        startYRef.current = touch.clientY;
        isReorderingRef.current = true;
        onDragStart();
      }
    }
  };

  const handleReorderTouchMove = (e: React.TouchEvent) => {
    if (!isReorderingRef.current) return;
    if (e.touches.length === 1 && startYRef.current !== 0) {
      const touch = e.touches[0];
      if (touch) {
        const currentY = touch.clientY;
        const deltaY = currentY - startYRef.current;

        if (Math.abs(deltaY) > 10) {
          setDragY(deltaY);
        }
      }
    }
  };

  const handleReorderTouchEnd = () => {
    if (!isReorderingRef.current) {
      return;
    }
    if (Math.abs(dragY) > 30) {
      const itemsMoved = dragY > 0 ? 1 : -1;
      const newIndex = index + itemsMoved;
      if (newIndex >= 0) {
        onReorder(newIndex);
      }
    }
    setDragY(0);
    startYRef.current = 0;
    isReorderingRef.current = false;
    onDragEnd();
    onTouchEnd();
  };

  return (
    <motion.div
      ref={itemRef}
      initial={false}
      animate={{
        y: isDragging ? dragY : 0,
        opacity: isDragging ? 0.7 : 1,
      }}
      style={{ touchAction: "pan-y" }}
      onContextMenu={handleContextMenu}
      className={`group relative flex items-center gap-3 p-3 transition-colors ${
        isSelected
          ? "bg-white/8 ring-1 ring-white/10"
          : isActive
            ? "bg-white/6 ring-1 ring-white/8"
            : isSmartTrack
              ? "bg-white/3 active:bg-white/5"
              : "active:bg-white/4"
      }`}
      onTouchStart={handleItemTouchStart}
      onTouchMove={handleItemTouchMove}
      onTouchEnd={handleItemTouchEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        onPlay();
      }}
    >
      {/* Smart track indicator */}
      {isSmartTrack && (
        <div className="absolute top-1/2 left-0 h-8 w-px -translate-y-1/2 rounded-r bg-[var(--color-accent)]" />
      )}

      {/* Drag handle */}
      <button
        className="flex-shrink-0 text-[var(--color-muted)] transition-colors active:text-[var(--color-text)]"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          handleReorderTouchStart(e);
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          handleReorderTouchMove(e);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          handleReorderTouchEnd();
        }}
        onTouchCancel={(e) => {
          e.stopPropagation();
          handleReorderTouchEnd();
        }}
        style={{ touchAction: "none" }}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Index */}
      <div className="w-6 flex-shrink-0 text-center text-sm text-[var(--color-muted)]">
        {index + 1}
      </div>

      {/* Cover image with play button */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-sm bg-white/4">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={altText}
            fill
            sizes="48px"
            className="object-cover"
            quality={75}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-muted)]">
            🎵
          </div>
        )}
        {/* Play button overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="theme-card-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
          aria-label={t("playFromHere")}
          title={t("playFromHere")}
        >
          <Play className="h-5 w-5 fill-white text-white" />
        </button>
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-[var(--color-text)]">
          {track.title}
        </h4>
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

      {/* Duration */}
      <span className="flex-shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
        {formatDuration(track.duration)}
      </span>

      {/* Play-next button */}
      {canPlayNext && onPlayNext ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayNext();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          className="flex-shrink-0 rounded p-1.5 text-[var(--color-subtext)] transition-colors active:bg-white/6 active:text-[var(--color-text)]"
          aria-label={tm("movePlayNext")}
          title={tm("playNext")}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : null}

      {/* Remove button */}
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
          className="flex-shrink-0 rounded p-1.5 text-[var(--color-subtext)] transition-colors active:bg-white/6 active:text-[var(--color-text)]"
          aria-label={t("removeFromQueue")}
          title={t("removeFromQueue")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

interface MobilePlayerProps {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "none" | "one" | "all";
  isLoading: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onToggleQueue?: () => void;
  onClose?: () => void;
  forceExpanded?: boolean;
}

type QueueUndoState = {
  track: Track;
  index: number;
  timerId: number;
};

export default function MobilePlayer(props: MobilePlayerProps) {
  const {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    isShuffled,
    repeatMode,
    isLoading,
    onPlayPause,
    onNext,
    onPrevious,
    onSeek,
    onToggleShuffle,
    onCycleRepeat,
    onSkipForward,
    onSkipBackward,
    onClose,
    forceExpanded = false,
  } = props;
  const t = useTranslations("player");
  const tq = useTranslations("queue");
  const tm = useTranslations("trackMenu");

  const {
    audioElement: contextAudioElement,
    addSmartTracks,
    refreshSmartTracks,
    smartQueueState,
    queuedTracks,
    playFromQueue,
    addToPlayNext,
    removeFromQueue,
    reorderQueue,
    saveQueueAsPlaylist,
    clearQueue,
  } = useGlobalPlayer();
  const { showToast } = useToast();

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const utils = api.useUtils();

  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    },
  );

  const localSettings = settingsStorage.getAll();
  const effectivePreferences = isAuthenticated ? preferences : localSettings;

  // Load smart queue settings
  const { data: smartQueueSettings } = api.music.getSmartQueueSettings.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const { data: favoriteData } = api.music.isFavorite.useQuery(
    { trackId: currentTrack?.id ?? 0 },
    { enabled: !!currentTrack && isAuthenticated },
  );

  const [isExpanded, setIsExpanded] = useState(forceExpanded);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [, setVisualizerEnabled] = useState(true);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [seekDirection, setSeekDirection] = useState<
    "forward" | "backward" | null
  >(null);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [queueSearchQuery, setQueueSearchQuery] = useState("");
  const [selectedQueueIndices, setSelectedQueueIndices] = useState<Set<number>>(
    new Set(),
  );
  const [lastSelectedQueueIndex, setLastSelectedQueueIndex] = useState<
    number | null
  >(null);
  const [showQueueSettingsModal, setShowQueueSettingsModal] = useState(false);
  const [smartTracksCount, setSmartTracksCount] = useState(5);
  const [similarityLevel, setSimilarityLevel] =
    useState<SimilarityPreference>("balanced");
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [queueUndoState, setQueueUndoState] = useState<QueueUndoState | null>(
    null,
  );
  const [queueThumbHeight, setQueueThumbHeight] = useState(0);
  const [queueScrollbarVisible, setQueueScrollbarVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);
  const expandedContentScrollRef = useRef<HTMLDivElement>(null);
  const expandedPanelRef = useRef<HTMLDivElement>(null);
  const expandedPanelHeightRef = useRef(0);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const queueScrollTrackRef = useRef<HTMLDivElement>(null);
  const queueScrollThumbRef = useRef<HTMLDivElement>(null);
  const queueScrollRafRef = useRef<number | null>(null);
  const shareFeedbackTimeoutRef = useRef<number | null>(null);
  const queueScrollbarVisibleRef = useRef(false);
  const queueThumbHeightRef = useRef(0);
  const queueScrollDragRef = useRef<{
    active: boolean;
    startY: number;
    startScrollTop: number;
  }>({
    active: false,
    startY: 0,
    startScrollTop: 0,
  });

  const { data: playlists, refetch: refetchPlaylists } =
    api.music.getPlaylists.useQuery(undefined, {
      enabled: isAuthenticated,
    });

  const addToPlaylist = api.music.addToPlaylist.useMutation({
    onSuccess: () => {
      hapticMedium();
      setShowPlaylistSelector(false);
      void refetchPlaylists();
    },
    onError: (error) => {
      console.error("Failed to add to playlist:", error);
      hapticMedium();
    },
  });

  const addFavorite = api.music.addFavorite.useMutation({
    onSuccess: async () => {
      if (currentTrack) {
        await utils.music.isFavorite.invalidate({ trackId: currentTrack.id });
        await utils.music.getFavorites.invalidate();
      }
    },
  });

  const removeFavorite = api.music.removeFavorite.useMutation({
    onSuccess: async () => {
      if (currentTrack) {
        await utils.music.isFavorite.invalidate({ trackId: currentTrack.id });
        await utils.music.getFavorites.invalidate();
      }
    },
  });

  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 100], [1, 0.7]);
  const artworkScale = useTransform(dragY, [0, 100], [1, 0.9]);
  const dragControls = useDragControls();
  const shouldReduceMotion = useReducedMotion();

  const seekX = useMotionValue(0);
  const queueThumbY = useMotionValue(0);

  const updateQueueScrollbar = useCallback(() => {
    const container = queueScrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const canScroll = scrollHeight > clientHeight + 1;

    if (queueScrollbarVisibleRef.current !== canScroll) {
      queueScrollbarVisibleRef.current = canScroll;
      setQueueScrollbarVisible(canScroll);
    }

    if (!canScroll) {
      queueThumbY.set(0);
      return;
    }

    const thumbHeight = Math.max(
      (clientHeight / scrollHeight) * clientHeight,
      36,
    );
    if (thumbHeight !== queueThumbHeightRef.current) {
      queueThumbHeightRef.current = thumbHeight;
      setQueueThumbHeight(thumbHeight);
    }

    const scrollable = scrollHeight - clientHeight;
    const maxOffset = Math.max(clientHeight - thumbHeight, 1);
    const offset = scrollable > 0 ? (scrollTop / scrollable) * maxOffset : 0;
    queueThumbY.set(offset);
  }, [queueThumbY]);

  const handleQueueScroll = useCallback(() => {
    if (queueScrollRafRef.current !== null) return;
    queueScrollRafRef.current = requestAnimationFrame(() => {
      queueScrollRafRef.current = null;
      updateQueueScrollbar();
    });
  }, [updateQueueScrollbar]);

  const handleQueueScrollbarPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = queueScrollRef.current;
      const track = queueScrollTrackRef.current;
      if (!container || !track) return;

      event.preventDefault();
      event.stopPropagation();

      const scrollable = container.scrollHeight - container.clientHeight;
      if (scrollable <= 0) return;

      const rect = track.getBoundingClientRect();
      const thumbHeight =
        queueThumbHeightRef.current ||
        Math.max(
          (container.clientHeight / container.scrollHeight) * rect.height,
          36,
        );
      const maxOffset = Math.max(rect.height - thumbHeight, 1);
      const isThumb = Boolean(
        (event.target as HTMLElement)?.closest(
          "[data-queue-scroll-thumb='true']",
        ),
      );

      if (!isThumb) {
        const clickOffset = event.clientY - rect.top - thumbHeight / 2;
        const thumbOffset = Math.min(Math.max(clickOffset, 0), maxOffset);
        container.scrollTop = (thumbOffset / maxOffset) * scrollable;
      }

      queueScrollDragRef.current = {
        active: true,
        startY: event.clientY,
        startScrollTop: container.scrollTop,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleQueueScrollbarPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!queueScrollDragRef.current.active) return;

      const container = queueScrollRef.current;
      const track = queueScrollTrackRef.current;
      if (!container || !track) return;

      const scrollable = container.scrollHeight - container.clientHeight;
      if (scrollable <= 0) return;

      const thumbHeight =
        queueThumbHeightRef.current ||
        Math.max(
          (container.clientHeight / container.scrollHeight) *
            track.clientHeight,
          36,
        );
      const maxOffset = Math.max(track.clientHeight - thumbHeight, 1);
      const delta = event.clientY - queueScrollDragRef.current.startY;
      const scrollDelta = (delta / maxOffset) * scrollable;
      const nextScrollTop = Math.min(
        Math.max(queueScrollDragRef.current.startScrollTop + scrollDelta, 0),
        scrollable,
      );

      container.scrollTop = nextScrollTop;
    },
    [],
  );

  const handleQueueScrollbarPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!queueScrollDragRef.current.active) return;
      queueScrollDragRef.current.active = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [],
  );

  const handlePlayPause = useCallback(() => {
    hapticMedium();
    onPlayPause();
  }, [onPlayPause]);

  const handleNext = useCallback(() => {
    hapticLight();
    onNext();
  }, [onNext]);

  const handlePrevious = useCallback(() => {
    hapticLight();
    onPrevious();
  }, [onPrevious]);

  const handleToggleShuffle = () => {
    hapticLight();
    onToggleShuffle();
  };

  const handleCycleRepeat = () => {
    hapticLight();
    onCycleRepeat();
  };

  // Load smart queue settings - intentional initialization from external state
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from external settings */
  useEffect(() => {
    if (smartQueueSettings) {
      setSmartTracksCount(smartQueueSettings.autoQueueCount);
      setSimilarityLevel(smartQueueSettings.similarityPreference);
    }
  }, [smartQueueSettings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSmartQueueAction = useCallback(
    async (action: "add" | "refresh") => {
      try {
        if (action === "refresh") {
          await refreshSmartTracks();
          showToast(tq("smartTracksRefreshed"), "success");
          return;
        }

        const added = await addSmartTracks();
        if (added.length === 0) {
          showToast(tq("noSmartTracksFound"), "info");
        } else {
          showToast(tq("addedSmartTracks", { count: added.length }), "success");
        }
      } catch (error) {
        console.error("[MobilePlayer] Smart tracks action failed:", error);
        showToast(tq("failedToUpdateSmartTracks"), "error");
      }
    },
    [addSmartTracks, refreshSmartTracks, showToast, tq],
  );

  const handleApplyQueueSettings = useCallback(
    async (settings: {
      count: number;
      similarityLevel: SimilarityPreference;
    }) => {
      try {
        setSmartTracksCount(settings.count);
        setSimilarityLevel(settings.similarityLevel);
        const added = await addSmartTracks({
          count: settings.count,
          similarityLevel: settings.similarityLevel,
        });
        if (added.length === 0) {
          showToast(tq("noSmartTracksFound"), "info");
        } else {
          showToast(tq("addedSmartTracks", { count: added.length }), "success");
        }
      } catch (error) {
        console.error(
          "[MobilePlayer] Failed to add smart tracks with custom settings:",
          error,
        );
        showToast(tq("failedToAddSmartTracks"), "error");
      }
    },
    [addSmartTracks, showToast, tq],
  );

  // Queue data processing
  const queueEntries = useMemo(
    () =>
      queuedTracks.map((qt, index) => ({
        track: qt.track,
        index,
        queueId: qt.queueId,
        isSmartTrack: qt.queueSource === "smart",
      })),
    [queuedTracks],
  );

  const filteredQueue = useMemo(() => {
    if (!queueSearchQuery.trim()) {
      return queueEntries;
    }

    const normalizedQuery = queueSearchQuery.toLowerCase();
    return queueEntries.filter(
      ({ track }) =>
        track.title.toLowerCase().includes(normalizedQuery) ||
        track.artist.name.toLowerCase().includes(normalizedQuery),
    );
  }, [queueEntries, queueSearchQuery]);

  const filteredNowPlaying = filteredQueue.length > 0 ? filteredQueue[0] : null;
  const filteredUserTracks = useMemo(() => {
    return filteredQueue.slice(1).filter((entry) => !entry.isSmartTrack);
  }, [filteredQueue]);

  const filteredSmartTracks = useMemo(() => {
    return filteredQueue.slice(1).filter((entry) => entry.isSmartTrack);
  }, [filteredQueue]);

  useEffect(() => {
    if (!showQueuePanel) return;
    const container = queueScrollRef.current;
    if (!container) return;

    updateQueueScrollbar();

    const handleScroll = () => handleQueueScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateQueueScrollbar());
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
      if (queueScrollRafRef.current !== null) {
        cancelAnimationFrame(queueScrollRafRef.current);
        queueScrollRafRef.current = null;
      }
    };
  }, [
    filteredQueue.length,
    handleQueueScroll,
    showQueuePanel,
    updateQueueScrollbar,
  ]);

  const totalDuration = useMemo(() => {
    return queue.reduce((acc, track) => acc + track.duration, 0);
  }, [queue]);

  const handleToggleQueueSelect = useCallback(
    (index: number, shiftKey = false) => {
      setSelectedQueueIndices((prev) => {
        const newSet = new Set(prev);

        if (shiftKey && lastSelectedQueueIndex !== null) {
          const start = Math.min(lastSelectedQueueIndex, index);
          const end = Math.max(lastSelectedQueueIndex, index);
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

      if (!shiftKey || lastSelectedQueueIndex === null) {
        setLastSelectedQueueIndex(index);
      }
    },
    [lastSelectedQueueIndex],
  );

  const handleMoveQueueTrackToNext = useCallback(
    (index: number) => {
      if (index <= 1) return;
      reorderQueue(index, 1);
      hapticSuccess();
    },
    [reorderQueue],
  );

  const handleRemoveQueueItemWithUndo = useCallback(
    (index: number) => {
      if (index === 0) return;
      const track = queue[index];
      if (!track) return;

      if (queueUndoState) {
        clearTimeout(queueUndoState.timerId);
      }

      removeFromQueue(index);
      hapticMedium();

      const timerId = window.setTimeout(() => {
        setQueueUndoState(null);
      }, 5000);

      setQueueUndoState({
        track,
        index,
        timerId,
      });
    },
    [queue, queueUndoState, removeFromQueue],
  );

  const handleUndoQueueRemove = useCallback(() => {
    if (!queueUndoState) return;

    clearTimeout(queueUndoState.timerId);
    addToPlayNext(queueUndoState.track);

    if (queueUndoState.index > 1) {
      window.setTimeout(() => {
        reorderQueue(1, queueUndoState.index);
      }, 0);
    }

    setQueueUndoState(null);
    hapticSuccess();
  }, [addToPlayNext, queueUndoState, reorderQueue]);

  const handleRemoveSelectedQueueItems = useCallback(() => {
    if (selectedQueueIndices.size === 0) return;

    const sortedIndices = Array.from(selectedQueueIndices).sort(
      (a, b) => b - a,
    );

    sortedIndices.forEach((index) => {
      removeFromQueue(index);
    });

    setSelectedQueueIndices(new Set());
    setLastSelectedQueueIndex(null);
    hapticSuccess();
    showToast(
      tq("removedFromQueueSummary", { count: sortedIndices.length }),
      "success",
    );
  }, [removeFromQueue, selectedQueueIndices, showToast, tq]);

  const handleClearQueueSelection = useCallback(() => {
    setSelectedQueueIndices(new Set());
    setLastSelectedQueueIndex(null);
  }, []);

  const clearQueueUndoState = useCallback(() => {
    setQueueUndoState((prev) => {
      if (prev) {
        clearTimeout(prev.timerId);
      }
      return null;
    });
  }, []);

  // Cleanup long press timer
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (queueUndoState) {
        clearTimeout(queueUndoState.timerId);
      }
      if (shareFeedbackTimeoutRef.current !== null) {
        clearTimeout(shareFeedbackTimeoutRef.current);
      }
    };
  }, [longPressTimer, queueUndoState]);

  const toggleFavorite = () => {
    if (!currentTrack || !isAuthenticated) return;

    if (favoriteData?.isFavorite) {
      hapticLight();
      removeFavorite.mutate({ trackId: currentTrack.id });
    } else {
      hapticSuccess();
      addFavorite.mutate({ track: currentTrack });
    }
    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 600);
  };

  const handleShareTrack = useCallback(async () => {
    if (!currentTrack) return;

    const queryParts = [
      currentTrack.title?.trim(),
      currentTrack.artist?.name?.trim(),
      currentTrack.album?.title?.trim(),
    ].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    if (queryParts.length === 0) {
      showToast(t("trackDetailsUnavailable"), "error");
      return;
    }

    const query = queryParts.map((part) => encodeURIComponent(part)).join("+");
    const shareUrl = `${window.location.origin}/?q=${query}`;

    if (shareFeedbackTimeoutRef.current !== null) {
      clearTimeout(shareFeedbackTimeoutRef.current);
      shareFeedbackTimeoutRef.current = null;
    }

    hapticLight();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      shareFeedbackTimeoutRef.current = window.setTimeout(() => {
        setIsShareCopied(false);
        shareFeedbackTimeoutRef.current = null;
      }, 1400);
      showToast(tm("linkCopied"), "success");
    } catch (error) {
      console.error("Failed to copy share link:", error);
      setIsShareCopied(false);
      showToast(tm("failedToCopyLink"), "error");
    }
  }, [currentTrack, showToast, t, tm]);

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      expandedPanelHeightRef.current = 0;
      return;
    }

    const panel = expandedPanelRef.current;
    if (!panel) return;

    const updateHeight = () => {
      expandedPanelHeightRef.current = panel.getBoundingClientRect().height;
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(panel);

    return () => {
      observer.disconnect();
    };
  }, [isExpanded]);

  // Sync audio element from context - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from context */
  useEffect(() => {
    if (contextAudioElement) {
      setAudioElement(contextAudioElement);
    } else if (typeof window !== "undefined") {
      const audio = document.querySelector("audio");
      if (audio) {
        setAudioElement(audio);
      }
    }
  }, [contextAudioElement]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync visualizer state from preferences - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from server prefs */
  useEffect(() => {
    if (preferences) {
      setVisualizerEnabled(preferences.visualizerEnabled ?? true);
    }
  }, [preferences]);

  useEffect(() => {
    if (isAuthenticated) return;
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(STORAGE_KEYS.VISUALIZER_ENABLED);
    if (stored !== null) {
      try {
        const parsed: unknown = JSON.parse(stored);
        setVisualizerEnabled(parsed === true);
      } catch {
        setVisualizerEnabled(stored === "true");
      }
    }
  }, [isAuthenticated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useAudioReactiveBackground(audioElement, isPlaying, false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = isSeeking ? seekTime : currentTime;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    hapticLight();
    onSeek(percentage * duration);
  };

  const handleProgressTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setIsSeeking(true);
    setSeekTime(percentage * duration);
  };

  const handleProgressTouchEnd = () => {
    if (isSeeking) {
      hapticLight();
      onSeek(seekTime);
      setIsSeeking(false);
    }
  };

  const handleArtworkDrag = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      if (Math.abs(offset) > 30) {
        const seekAmount = (offset / artworkRef.current!.offsetWidth) * 30;
        const newTime = Math.max(
          0,
          Math.min(duration, currentTime + seekAmount),
        );
        setSeekTime(newTime);
        setIsSeeking(true);
        setSeekDirection(offset > 0 ? "forward" : "backward");
      }
    },
    [currentTime, duration],
  );

  const handleArtworkDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      const velocity = info.velocity.x;

      if (Math.abs(offset) > 50 || Math.abs(velocity) > 300) {
        if (isSeeking) {
          hapticMedium();
          onSeek(seekTime);
        }
      }
      setIsSeeking(false);
      setSeekDirection(null);
      seekX.set(0);
    },
    [isSeeking, seekTime, onSeek, seekX],
  );

  const closeExpandedPlayer = useCallback(() => {
    hapticLight();
    setShowPlaylistSelector(false);
    if (onClose) {
      onClose();
      return;
    }
    setIsExpanded(false);
  }, [onClose]);

  const isDragExemptTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest("[data-drag-exempt='true']") ??
      target.closest("button") ??
      target.closest("input") ??
      target.closest("select") ??
      target.closest("textarea") ??
      target.closest("a") ??
      target.closest("[role='slider']"),
    );
  };

  const handleExpandedPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (isDragExemptTarget(event.target)) {
      return;
    }

    const scrollContainer = expandedContentScrollRef.current;
    if (
      scrollContainer &&
      event.target instanceof Node &&
      scrollContainer.contains(event.target) &&
      scrollContainer.scrollTop > 0
    ) {
      return;
    }

    dragControls.start(event);
  };

  const handleExpandedDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const measuredPanelHeight =
      expandedPanelHeightRef.current > 0
        ? expandedPanelHeightRef.current
        : undefined;
    const panelHeightFromRef =
      expandedPanelRef.current?.getBoundingClientRect().height;
    const panelHeight =
      measuredPanelHeight ??
      panelHeightFromRef ??
      (typeof window !== "undefined" ? window.innerHeight : 0);
    const dragDecision = getMobilePlayerDragDecision(
      info.offset.y,
      panelHeight,
      info.velocity.y,
    );

    if (dragDecision === "dismiss") {
      closeExpandedPlayer();
      return;
    }

    if (shouldReduceMotion) {
      dragY.set(0);
      return;
    }

    void animate(dragY, 0, springPresets.snappy);
  };

  if (!currentTrack) return null;

  const coverArt =
    currentTrack.album.cover_xl ??
    currentTrack.album.cover_big ??
    currentTrack.album.cover_medium ??
    currentTrack.album.cover;
  const panelSurfaceStyle = {
    border: "1px solid var(--shell-border)",
    background: "var(--color-surface)",
    boxShadow: "none",
  } as const;
  const progressFillColor = "var(--color-accent)";
  const dividerColor = "rgba(255, 255, 255, 0.08)";
  const skipBackColor = "var(--color-text)";
  const skipForwardColor = "var(--color-text)";

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <>
            {}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="theme-chrome-backdrop fixed inset-0 z-[98]"
              onClick={closeExpandedPlayer}
            />

            {}
            <motion.div
              ref={expandedPanelRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              drag="y"
              dragConstraints={{
                top: 0,
                bottom:
                  typeof window !== "undefined" ? window.innerHeight : 1024,
              }}
              dragElastic={0}
              dragMomentum={false}
              dragListener={false}
              dragControls={dragControls}
              onPointerDownCapture={handleExpandedPointerDownCapture}
              onDragEnd={handleExpandedDragEnd}
              style={{ y: dragY, opacity }}
              transition={
                shouldReduceMotion ? { duration: 0 } : springPresets.gentle
              }
              className="fixed inset-0 z-[99] flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+20px)]"
            >
              {}
              <div className="absolute inset-0 bg-black/10" />

              {}
              <div className="mobile-player-expanded mobile-player-milkglass relative z-10 flex flex-1 flex-col">
                <div className="flex justify-center pt-1 pb-0.5">
                  <div className="h-1 w-12 rounded-full bg-white/16" />
                </div>

                <div className="mobile-player-header flex items-center justify-between px-6 pt-1">
                  <motion.button
                    onClick={closeExpandedPlayer}
                    whileTap={{ scale: 0.9 }}
                    className="touch-target rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                    aria-label={t("collapsePlayer")}
                    title={t("collapsePlayer")}
                    data-drag-exempt="true"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </motion.button>
                  <div className="w-12" />
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-6 pt-2">
                  <div
                    ref={expandedContentScrollRef}
                    className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain"
                  >
                    <div className="mobile-player-body flex min-h-0 flex-1 flex-col items-center justify-start gap-4">
                      <motion.div
                        ref={artworkRef}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{ scale: artworkScale }}
                        data-drag-exempt="true"
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.1}
                        onDrag={handleArtworkDrag}
                        onDragEnd={handleArtworkDragEnd}
                        transition={springPresets.smooth}
                        className={`mobile-player-artwork relative w-full cursor-grab active:cursor-grabbing ${
                          effectivePreferences?.compactMode
                            ? "max-w-[280px]"
                            : "max-w-[360px]"
                        }`}
                      >
                        <motion.div
                          key="artwork"
                          initial={{ rotateY: -90, opacity: 0 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          {coverArt ? (
                            <div className="relative">
                              <div className="relative overflow-hidden rounded-[24px] border border-[color:var(--shell-border)]">
                                <Image
                                  src={coverArt}
                                  alt={currentTrack.title}
                                  width={450}
                                  height={450}
                                  className="relative z-10 aspect-square w-full rounded-[24px] object-cover"
                                  priority
                                  quality={90}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center rounded-[24px] border border-[color:var(--shell-border)] bg-white/4 text-6xl text-[var(--color-muted)]">
                              🎵
                            </div>
                          )}
                        </motion.div>

                        <AnimatePresence>
                          {isSeeking && seekDirection && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="theme-card-overlay absolute inset-0 flex items-center justify-center rounded-[30px]"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-4xl font-bold text-[var(--color-text)] tabular-nums">
                                  {formatTime(seekTime)}
                                </span>
                                <span
                                  className={`text-sm ${seekDirection === "forward" ? "text-[var(--color-accent-strong)]" : "text-[var(--color-accent)]"}`}
                                >
                                  {seekDirection === "forward" ? "+" : "-"}
                                  {Math.abs(Math.round(seekTime - currentTime))}
                                  s
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isLoading && (
                          <div className="theme-card-overlay absolute inset-0 flex items-center justify-center rounded-[30px]">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="h-12 w-12 rounded-full border-4 border-[var(--color-accent)] border-t-transparent"
                            />
                          </div>
                        )}
                      </motion.div>

                      <div
                        className={`mobile-player-info-controls flex w-full flex-col items-center ${
                          effectivePreferences?.compactMode ? "gap-2" : "gap-4"
                        }`}
                      >
                        <div className="mobile-player-content w-full">
                          <div
                            className={`rounded-2xl ${
                              effectivePreferences?.compactMode
                                ? "px-3 py-1.5"
                                : "px-4 py-2"
                            }`}
                            style={panelSurfaceStyle}
                          >
                            <div
                              className={`flex items-start justify-between ${
                                effectivePreferences?.compactMode
                                  ? "gap-2"
                                  : "gap-4"
                              }`}
                            >
                              <div className="min-w-0 text-left">
                                <motion.h2
                                  key={currentTrack.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`leading-tight font-bold text-[var(--color-text)] ${
                                    effectivePreferences?.compactMode
                                      ? "text-lg"
                                      : "text-xl"
                                  }`}
                                >
                                  {currentTrack.title}
                                </motion.h2>
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.1 }}
                                  className={`mt-1 font-medium text-[var(--color-subtext)] ${
                                    effectivePreferences?.compactMode
                                      ? "text-[11px]"
                                      : "text-xs"
                                  }`}
                                >
                                  {currentTrack.artist.name}
                                </motion.p>
                                {currentTrack.album?.title && (
                                  <p
                                    className={`mt-0.5 truncate text-[var(--color-subtext)] ${
                                      effectivePreferences?.compactMode
                                        ? "text-[9px]"
                                        : "text-[10px]"
                                    }`}
                                  >
                                    {currentTrack.album.title}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end text-[11px] text-[var(--color-subtext)]">
                                <span
                                  className={`text-[var(--color-muted)] ${
                                    effectivePreferences?.compactMode
                                      ? "text-[8px]"
                                      : "text-[9px]"
                                  }`}
                                >
                                  {tq("label")}
                                </span>
                                <span
                                  className={`font-semibold text-[var(--color-text)] tabular-nums ${
                                    effectivePreferences?.compactMode
                                      ? "text-base"
                                      : "text-lg"
                                  }`}
                                >
                                  {queue.length}
                                </span>
                                <span
                                  className={`mt-1 text-[var(--color-muted)] ${
                                    effectivePreferences?.compactMode
                                      ? "text-[8px]"
                                      : "text-[9px]"
                                  }`}
                                >
                                  {tq("total")}
                                </span>
                                <span
                                  className={`font-semibold text-[var(--color-text)] tabular-nums ${
                                    effectivePreferences?.compactMode
                                      ? "text-xs"
                                      : "text-sm"
                                  }`}
                                >
                                  {formatDuration(totalDuration)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mobile-player-controls mobile-player-content mt-0.5 w-full pb-1">
                          <div
                            className="rounded-[20px] px-3 py-1.5"
                            style={panelSurfaceStyle}
                          >
                            <div className="px-1 pb-1.5">
                              <div
                                ref={progressRef}
                                className="slider-track group relative h-1.5 cursor-pointer rounded-full"
                                onClick={handleProgressClick}
                                onTouchStart={(e) => {
                                  setIsSeeking(true);
                                  haptic("selection");
                                  handleProgressTouch(e);
                                }}
                                onTouchMove={(e) => {
                                  handleProgressTouch(e);
                                  hapticSliderContinuous(
                                    seekTime,
                                    0,
                                    duration,
                                    {
                                      intervalMs: 35,
                                      tickThreshold: 1.5,
                                    },
                                  );
                                }}
                                onTouchEnd={() => {
                                  handleProgressTouchEnd();
                                  hapticSliderEnd();
                                }}
                                role="slider"
                                aria-label={t("seek")}
                                aria-valuemin={0}
                                aria-valuemax={duration}
                                aria-valuenow={displayTime}
                              >
                                {isSeeking && (
                                  <motion.div
                                    className="absolute inset-0 rounded-full"
                                    style={{
                                      background: "rgba(255, 59, 59, 0.16)",
                                    }}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1.05 }}
                                    exit={{ opacity: 0 }}
                                    transition={springPresets.slider}
                                  />
                                )}
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{
                                    background: progressFillColor,
                                    width: `${isSeeking ? (seekTime / duration) * 100 : progress}%`,
                                  }}
                                  transition={
                                    isSeeking
                                      ? { duration: 0 }
                                      : springPresets.slider
                                  }
                                />
                                <motion.div
                                  className="absolute top-1/2 rounded-full bg-[var(--color-text)]"
                                  style={{
                                    left: `${isSeeking ? (seekTime / duration) * 100 : progress}%`,
                                  }}
                                  initial={{ scale: 1, x: "-50%", y: "-50%" }}
                                  animate={{
                                    scale: isSeeking ? 1.3 : 1,
                                    width: isSeeking ? 18 : 14,
                                    height: isSeeking ? 18 : 14,
                                  }}
                                  whileHover={{ scale: 1.15 }}
                                  transition={springPresets.sliderThumb}
                                >
                                  {isSeeking && (
                                    <motion.div
                                      className="absolute inset-0 rounded-full"
                                      style={{
                                        backgroundColor: progressFillColor,
                                      }}
                                      initial={{ scale: 1, opacity: 0.5 }}
                                      animate={{ scale: 2, opacity: 0 }}
                                      transition={{
                                        duration: 0.5,
                                        repeat: Infinity,
                                      }}
                                    />
                                  )}
                                </motion.div>
                              </div>
                              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-subtext)] tabular-nums">
                                <motion.span
                                  animate={{ scale: isSeeking ? 1.05 : 1 }}
                                  transition={springPresets.snappy}
                                >
                                  {formatTime(displayTime)}
                                </motion.span>
                                <motion.span
                                  animate={{ scale: isSeeking ? 1.05 : 1 }}
                                  transition={springPresets.snappy}
                                >
                                  -
                                  {formatTime(
                                    Math.max(0, duration - displayTime),
                                  )}
                                </motion.span>
                              </div>
                            </div>

                            <div
                              className="h-px w-full"
                              style={{
                                background: dividerColor,
                              }}
                            />

                            <div className="flex items-center justify-between px-1">
                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleShuffle();
                                }}
                                whileTap={{ scale: 0.9 }}
                                className={`touch-target rounded-full p-1 transition-colors ${
                                  isShuffled
                                    ? "bg-white/6 text-[var(--color-accent)]"
                                    : "text-[var(--color-subtext)] hover:bg-white/4 hover:text-[var(--color-text)]"
                                }`}
                                aria-label={
                                  isShuffled
                                    ? t("disableShuffle")
                                    : t("enableShuffle")
                                }
                                title={t("shuffleShortcut")}
                              >
                                <Shuffle
                                  style={{
                                    width:
                                      "var(--mobile-player-control-button-size)",
                                    height:
                                      "var(--mobile-player-control-button-size)",
                                  }}
                                />
                              </motion.button>

                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  hapticLight();
                                  onSkipBackward();
                                }}
                                whileTap={{ scale: 0.9 }}
                                className="touch-target rounded-full p-1 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                                title={t("skipBackwardShort")}
                                aria-label={t("skipBackward10Seconds")}
                              >
                                <svg
                                  style={{
                                    width:
                                      "var(--mobile-player-control-button-size)",
                                    height:
                                      "var(--mobile-player-control-button-size)",
                                  }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
                                  />
                                </svg>
                              </motion.button>

                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  hapticLight();
                                  onSkipForward();
                                }}
                                whileTap={{ scale: 0.9 }}
                                className="touch-target rounded-full p-1 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                                title={t("skipForwardShort")}
                                aria-label={t("skipForward10Seconds")}
                              >
                                <svg
                                  style={{
                                    width:
                                      "var(--mobile-player-control-button-size)",
                                    height:
                                      "var(--mobile-player-control-button-size)",
                                  }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"
                                  />
                                </svg>
                              </motion.button>

                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCycleRepeat();
                                }}
                                whileTap={{ scale: 0.9 }}
                                className={`touch-target rounded-full p-1 transition-colors ${
                                  repeatMode !== "none"
                                    ? "bg-white/6 text-[var(--color-accent)]"
                                    : "text-[var(--color-subtext)] hover:bg-white/4 hover:text-[var(--color-text)]"
                                }`}
                                aria-label={
                                  repeatMode === "none"
                                    ? t("enableRepeat")
                                    : repeatMode === "one"
                                      ? t("repeatOneNext")
                                      : t("repeatAllNext")
                                }
                                title={t("repeatShortcut", {
                                  mode:
                                    repeatMode === "one"
                                      ? t("repeatModeOne")
                                      : repeatMode === "all"
                                        ? t("repeatModeAll")
                                        : t("repeatModeOff"),
                                })}
                              >
                                {repeatMode === "one" ? (
                                  <Repeat1
                                    style={{
                                      width:
                                        "var(--mobile-player-control-button-size)",
                                      height:
                                        "var(--mobile-player-control-button-size)",
                                    }}
                                  />
                                ) : (
                                  <Repeat
                                    style={{
                                      width:
                                        "var(--mobile-player-control-button-size)",
                                      height:
                                        "var(--mobile-player-control-button-size)",
                                    }}
                                  />
                                )}
                              </motion.button>
                            </div>

                            <div
                              className="flex items-center justify-center"
                              style={{
                                gap: "var(--mobile-player-controls-gap)",
                              }}
                            >
                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePrevious();
                                }}
                                whileTap={{ scale: 0.9 }}
                                className="touch-target-lg rounded-full text-[var(--color-text)] transition-colors hover:bg-white/4"
                                style={{ color: skipBackColor }}
                                aria-label={t("previousTrack")}
                                title={t("previousTrack")}
                              >
                                <SkipBack
                                  style={{
                                    width:
                                      "var(--mobile-player-skip-button-size)",
                                    height:
                                      "var(--mobile-player-skip-button-size)",
                                  }}
                                  className="fill-current"
                                />
                              </motion.button>

                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePlayPause();
                                }}
                                whileTap={{ scale: 0.92 }}
                                whileHover={{ scale: 1.02 }}
                                className="relative flex items-center justify-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  width:
                                    "var(--mobile-player-play-button-size)",
                                  height:
                                    "var(--mobile-player-play-button-size)",
                                }}
                                aria-label={
                                  isPlaying ? t("pauseTrack") : t("playTrack")
                                }
                                title={
                                  isPlaying ? t("pauseTrack") : t("playTrack")
                                }
                                disabled={isLoading}
                              >
                                {isPlaying ? (
                                  <Pause className="relative h-7 w-7 fill-current" />
                                ) : (
                                  <Play className="relative ml-0.5 h-7 w-7 fill-current" />
                                )}
                              </motion.button>

                              <motion.button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (queue.length > 0) {
                                    handleNext();
                                  }
                                }}
                                disabled={queue.length === 0}
                                whileTap={{ scale: 0.9 }}
                                className="touch-target-lg rounded-full text-[var(--color-text)] transition-colors hover:bg-white/4 disabled:cursor-not-allowed disabled:opacity-40"
                                style={{ color: skipForwardColor }}
                                aria-label={t("nextTrack")}
                                title={t("nextTrack")}
                              >
                                <SkipForward
                                  style={{
                                    width:
                                      "var(--mobile-player-skip-button-size)",
                                    height:
                                      "var(--mobile-player-skip-button-size)",
                                  }}
                                  className="fill-current"
                                />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mobile-player-content w-full pt-2 pb-[calc(env(safe-area-inset-bottom)+4px)]"
                    data-drag-exempt="true"
                  >
                    <div
                      className="rounded-[16px] px-2 py-1.5"
                      style={panelSurfaceStyle}
                      data-drag-exempt="true"
                    >
                      <MobilePlayerFooterActions
                        queueLength={queue.length}
                        showQueuePanel={showQueuePanel}
                        onToggleQueuePanel={() => {
                          hapticMedium();
                          setShowPlaylistSelector(false);
                          setShowQueuePanel((prev) => {
                            const next = !prev;
                            if (!next) {
                              clearQueueUndoState();
                            }
                            return next;
                          });
                        }}
                        isAuthenticated={isAuthenticated}
                        showPlaylistSelector={showPlaylistSelector}
                        onTogglePlaylistSelector={() => {
                          if (!isAuthenticated) {
                            hapticMedium();
                            return;
                          }
                          hapticLight();
                          setShowPlaylistSelector((prev) => !prev);
                        }}
                        onClosePlaylistSelector={() =>
                          setShowPlaylistSelector(false)
                        }
                        playlists={playlists}
                        onAddToPlaylist={(playlistId) => {
                          if (currentTrack) {
                            addToPlaylist.mutate({
                              playlistId,
                              track: currentTrack,
                            });
                          }
                        }}
                        isAddingToPlaylist={addToPlaylist.isPending}
                        onShare={() => {
                          void handleShareTrack();
                        }}
                        shareCopied={isShareCopied}
                        favoriteIsActive={Boolean(favoriteData?.isFavorite)}
                        favoriteDisabled={
                          !isAuthenticated ||
                          addFavorite.isPending ||
                          removeFavorite.isPending
                        }
                        isHeartAnimating={isHeartAnimating}
                        onToggleFavorite={toggleFavorite}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {}
            <AnimatePresence>
              {showQueuePanel && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="theme-chrome-backdrop fixed inset-0 z-[100]"
                    onClick={() => {
                      hapticLight();
                      clearQueueUndoState();
                      setShowQueuePanel(false);
                    }}
                  />
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0, right: 0.2 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 100 || info.velocity.x > 300) {
                        hapticLight();
                        clearQueueUndoState();
                        setShowQueuePanel(false);
                      }
                    }}
                    transition={springPresets.gentle}
                    className="theme-chrome-drawer safe-bottom fixed top-0 right-0 z-[101] flex h-full w-full max-w-md flex-col border-l"
                  >
                    <div className="flex flex-col gap-3 border-b border-[rgba(255,255,255,0.08)] p-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-[var(--color-text)]">
                          {tq("title", { count: queue.length })}
                        </h2>
                        <div className="flex items-center gap-2">
                          {queue.length > 0 && (
                            <>
                              <motion.button
                                onClick={() => {
                                  hapticLight();
                                  void handleSmartQueueAction(
                                    smartQueueState.isActive
                                      ? "refresh"
                                      : "add",
                                  );
                                }}
                                disabled={smartQueueState.isLoading}
                                whileTap={{ scale: 0.9 }}
                                className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={
                                  smartQueueState.isActive
                                    ? tq("refreshSmartTracks")
                                    : tq("addSmartTracks")
                                }
                                title={
                                  smartQueueState.isActive
                                    ? tq("refreshSmartTracks")
                                    : tq("addSmartTracks")
                                }
                              >
                                {smartQueueState.isLoading ? (
                                  <LoadingSpinner
                                    size="sm"
                                    label={tq("loadingSmartTracks")}
                                  />
                                ) : (
                                  <Sparkles className="h-5 w-5" />
                                )}
                              </motion.button>
                              <motion.button
                                onClick={() => {
                                  hapticLight();
                                  setShowQueueSettingsModal(true);
                                }}
                                whileTap={{ scale: 0.9 }}
                                className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                                aria-label={tq("smartTracksSettings")}
                                title={tq("smartTracksSettings")}
                              >
                                <Settings className="h-5 w-5" />
                              </motion.button>
                            </>
                          )}
                          {isAuthenticated &&
                            (queue.length > 0 || currentTrack) && (
                              <motion.button
                                onClick={async () => {
                                  hapticLight();
                                  try {
                                    await saveQueueAsPlaylist();
                                    showToast(tq("savedAsPlaylist"), "success");
                                  } catch {
                                    showToast(
                                      tq("failedToSavePlaylist"),
                                      "error",
                                    );
                                  }
                                }}
                                whileTap={{ scale: 0.9 }}
                                className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                                aria-label={tq("saveAsPlaylist")}
                                title={tq("saveAsPlaylist")}
                              >
                                <Save className="h-5 w-5" />
                              </motion.button>
                            )}
                          {queue.length > 0 && (
                            <motion.button
                              onClick={() => {
                                hapticMedium();
                                clearQueue();
                                handleClearQueueSelection();
                                clearQueueUndoState();
                                showToast(tq("cleared"), "success");
                              }}
                              whileTap={{ scale: 0.9 }}
                              className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                              aria-label={tq("clearQueue")}
                              title={tq("clearQueue")}
                            >
                              <Trash2 className="h-5 w-5" />
                            </motion.button>
                          )}
                          <motion.button
                            onClick={() => {
                              hapticLight();
                              clearQueueUndoState();
                              setShowQueuePanel(false);
                              handleClearQueueSelection();
                              setQueueSearchQuery("");
                            }}
                            whileTap={{ scale: 0.9 }}
                            className="rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]"
                            aria-label={tq("closeQueue")}
                            title={tq("closeQueue")}
                          >
                            <X className="h-6 w-6" />
                          </motion.button>
                        </div>
                      </div>

                      {/* Selection bar */}
                      {selectedQueueIndices.size > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-2 rounded-lg border border-[color:var(--shell-border)] bg-white/6 p-3"
                        >
                          <span className="text-sm font-medium text-[var(--color-text)]">
                            {tq("selectedSummary", {
                              count: selectedQueueIndices.size,
                            })}
                          </span>
                          <div className="flex-1" />
                          <motion.button
                            onClick={handleRemoveSelectedQueueItems}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 rounded-lg bg-white/8 px-3 py-1.5 text-sm font-medium transition-colors active:bg-white/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            {tq("removeSelected")}
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              hapticLight();
                              handleClearQueueSelection();
                            }}
                            whileTap={{ scale: 0.95 }}
                            className="rounded-lg bg-white/8 px-3 py-1.5 text-sm font-medium transition-colors active:bg-white/10"
                          >
                            {tq("clearSelection")}
                          </motion.button>
                        </motion.div>
                      )}

                      {queueUndoState && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-2 rounded-lg border border-[color:var(--shell-border)] bg-white/6 p-3"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                            {tq("removedTrack", {
                              title: queueUndoState.track.title,
                            })}
                          </span>
                          <motion.button
                            onClick={() => {
                              handleUndoQueueRemove();
                            }}
                            whileTap={{ scale: 0.95 }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-3 py-1.5 text-sm font-medium transition-colors active:bg-white/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {tq("undo")}
                          </motion.button>
                        </motion.div>
                      )}

                      {/* Search */}
                      {queue.length > 0 && (
                        <div className="relative">
                          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                          <input
                            type="text"
                            placeholder={tq("searchPlaceholder")}
                            value={queueSearchQuery}
                            onChange={(e) =>
                              setQueueSearchQuery(e.target.value)
                            }
                            className="theme-input w-full rounded-lg py-2 pr-4 pl-10 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none"
                          />
                          {queueSearchQuery && (
                            <motion.button
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => setQueueSearchQuery("")}
                              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-subtext)] transition-colors active:text-[var(--color-text)]"
                              aria-label={tq("clearSearch")}
                              title={tq("clearSearch")}
                            >
                              <X className="h-4 w-4" />
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="relative flex-1">
                      <div
                        ref={queueScrollRef}
                        className="desktop-scroll h-full overflow-y-auto overscroll-contain scroll-smooth pr-3"
                      >
                        {queue.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                            <div className="mb-4 text-6xl">🎵</div>
                            <p className="mb-2 text-lg font-medium text-[var(--color-text)]">
                              {tq("emptyTitle")}
                            </p>
                            <p className="text-sm text-[var(--color-subtext)]">
                              {tq("emptyDescription")}
                            </p>
                          </div>
                        ) : filteredQueue.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                            <Search className="mb-4 h-12 w-12 text-[var(--color-muted)]" />
                            <p className="mb-2 text-lg font-medium text-[var(--color-text)]">
                              {tq("noResultsTitle")}
                            </p>
                            <p className="text-sm text-[var(--color-subtext)]">
                              {tq("noResultsDescription")}
                            </p>
                          </div>
                        ) : (
                          <div>
                            {/* Now Playing */}
                            {filteredNowPlaying && (
                              <div className="border-b border-[rgba(255,255,255,0.05)]">
                                <div className="bg-white/3 px-3 py-2 text-xs font-medium text-[var(--color-subtext)]">
                                  {tq("nowPlaying")}
                                </div>
                                <QueueItem
                                  track={filteredNowPlaying.track}
                                  index={filteredNowPlaying.index}
                                  isActive={
                                    currentTrack?.id ===
                                    filteredNowPlaying.track.id
                                  }
                                  isSelected={selectedQueueIndices.has(
                                    filteredNowPlaying.index,
                                  )}
                                  isSmartTrack={filteredNowPlaying.isSmartTrack}
                                  onPlay={() => {
                                    hapticLight();
                                    playFromQueue(filteredNowPlaying.index);
                                  }}
                                  onPlayNext={() => {
                                    handleMoveQueueTrackToNext(
                                      filteredNowPlaying.index,
                                    );
                                  }}
                                  onRemove={() => {
                                    handleRemoveQueueItemWithUndo(
                                      filteredNowPlaying.index,
                                    );
                                  }}
                                  onToggleSelect={(e) => {
                                    if (
                                      e.type === "touchstart" &&
                                      "touches" in e
                                    ) {
                                      if (e.touches.length === 1) {
                                        const timer = setTimeout(() => {
                                          hapticMedium();
                                          handleToggleQueueSelect(
                                            filteredNowPlaying.index,
                                          );
                                        }, 500);
                                        setLongPressTimer(timer);
                                      }
                                    } else {
                                      if (longPressTimer) {
                                        clearTimeout(longPressTimer);
                                        setLongPressTimer(null);
                                      }
                                      handleToggleQueueSelect(
                                        filteredNowPlaying.index,
                                        e.shiftKey,
                                      );
                                    }
                                  }}
                                  onTouchEnd={() => {
                                    if (longPressTimer) {
                                      clearTimeout(longPressTimer);
                                      setLongPressTimer(null);
                                    }
                                  }}
                                  canRemove={filteredNowPlaying.index !== 0}
                                  canPlayNext={filteredNowPlaying.index > 1}
                                  onDragStart={() =>
                                    setDraggedIndex(filteredNowPlaying.index)
                                  }
                                  onDragEnd={() => setDraggedIndex(null)}
                                  isDragging={
                                    draggedIndex === filteredNowPlaying.index
                                  }
                                  onReorder={(newIndex) => {
                                    if (newIndex !== filteredNowPlaying.index) {
                                      reorderQueue(
                                        filteredNowPlaying.index,
                                        newIndex,
                                      );
                                      hapticSuccess();
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {/* User Tracks */}
                            {filteredUserTracks.length > 0 && (
                              <div className="border-b border-[rgba(255,255,255,0.05)]">
                                <div className="border-b border-white/6 px-3 py-2 text-xs font-medium text-[var(--color-subtext)]">
                                  {tq("nextInQueue")}
                                </div>
                                <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                                  {filteredUserTracks.map((entry) => (
                                    <QueueItem
                                      key={entry.queueId}
                                      track={entry.track}
                                      index={entry.index}
                                      isActive={
                                        currentTrack?.id === entry.track.id
                                      }
                                      isSelected={selectedQueueIndices.has(
                                        entry.index,
                                      )}
                                      isSmartTrack={entry.isSmartTrack}
                                      onPlay={() => {
                                        hapticLight();
                                        playFromQueue(entry.index);
                                      }}
                                      onPlayNext={() => {
                                        handleMoveQueueTrackToNext(entry.index);
                                      }}
                                      onRemove={() => {
                                        handleRemoveQueueItemWithUndo(
                                          entry.index,
                                        );
                                      }}
                                      onToggleSelect={(e) => {
                                        if (
                                          e.type === "touchstart" &&
                                          "touches" in e
                                        ) {
                                          if (e.touches.length === 1) {
                                            const timer = setTimeout(() => {
                                              hapticMedium();
                                              handleToggleQueueSelect(
                                                entry.index,
                                              );
                                            }, 500);
                                            setLongPressTimer(timer);
                                          }
                                        } else {
                                          if (longPressTimer) {
                                            clearTimeout(longPressTimer);
                                            setLongPressTimer(null);
                                          }
                                          handleToggleQueueSelect(
                                            entry.index,
                                            e.shiftKey,
                                          );
                                        }
                                      }}
                                      onTouchEnd={() => {
                                        if (longPressTimer) {
                                          clearTimeout(longPressTimer);
                                          setLongPressTimer(null);
                                        }
                                      }}
                                      canRemove={entry.index !== 0}
                                      canPlayNext={entry.index > 1}
                                      onDragStart={() =>
                                        setDraggedIndex(entry.index)
                                      }
                                      onDragEnd={() => setDraggedIndex(null)}
                                      isDragging={draggedIndex === entry.index}
                                      onReorder={(newIndex) => {
                                        if (newIndex !== entry.index) {
                                          reorderQueue(entry.index, newIndex);
                                          hapticSuccess();
                                        }
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Smart Tracks */}
                            {(filteredSmartTracks.length > 0 ||
                              smartQueueState.isLoading) && (
                              <div className="border-b border-[rgba(255,255,255,0.05)]">
                                <div className="flex items-center gap-2 border-b border-white/6 px-3 py-2 text-xs font-medium text-[var(--color-subtext)]">
                                  <span>{tq("smartTracks")}</span>
                                  {smartQueueState.isLoading && (
                                    <LoadingSpinner
                                      size="sm"
                                      label={tq("loadingSmartTracks")}
                                    />
                                  )}
                                </div>
                                {smartQueueState.isLoading &&
                                filteredSmartTracks.length === 0 ? (
                                  <div className="flex items-center justify-center px-3 py-4">
                                    <div className="flex flex-col items-center gap-2">
                                      <LoadingSpinner
                                        size="md"
                                        label={tq("loadingSmartTracks")}
                                      />
                                      <p className="text-xs text-[var(--color-subtext)]">
                                        {tq("findingSimilarTracks")}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                                    {filteredSmartTracks.map((entry) => (
                                      <QueueItem
                                        key={entry.queueId}
                                        track={entry.track}
                                        index={entry.index}
                                        isActive={
                                          currentTrack?.id === entry.track.id
                                        }
                                        isSelected={selectedQueueIndices.has(
                                          entry.index,
                                        )}
                                        isSmartTrack={entry.isSmartTrack}
                                        onPlay={() => {
                                          hapticLight();
                                          playFromQueue(entry.index);
                                        }}
                                        onPlayNext={() => {
                                          handleMoveQueueTrackToNext(
                                            entry.index,
                                          );
                                        }}
                                        onRemove={() => {
                                          handleRemoveQueueItemWithUndo(
                                            entry.index,
                                          );
                                        }}
                                        onToggleSelect={(e) => {
                                          if (
                                            e.type === "touchstart" &&
                                            "touches" in e
                                          ) {
                                            if (e.touches.length === 1) {
                                              const timer = setTimeout(() => {
                                                hapticMedium();
                                                handleToggleQueueSelect(
                                                  entry.index,
                                                );
                                              }, 500);
                                              setLongPressTimer(timer);
                                            }
                                          } else {
                                            if (longPressTimer) {
                                              clearTimeout(longPressTimer);
                                              setLongPressTimer(null);
                                            }
                                            handleToggleQueueSelect(
                                              entry.index,
                                              e.shiftKey,
                                            );
                                          }
                                        }}
                                        onTouchEnd={() => {
                                          if (longPressTimer) {
                                            clearTimeout(longPressTimer);
                                            setLongPressTimer(null);
                                          }
                                        }}
                                        canRemove={entry.index !== 0}
                                        canPlayNext={entry.index > 1}
                                        onDragStart={() =>
                                          setDraggedIndex(entry.index)
                                        }
                                        onDragEnd={() => setDraggedIndex(null)}
                                        isDragging={
                                          draggedIndex === entry.index
                                        }
                                        onReorder={(newIndex) => {
                                          if (newIndex !== entry.index) {
                                            reorderQueue(entry.index, newIndex);
                                            hapticSuccess();
                                          }
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {queueScrollbarVisible && (
                        <div
                          ref={queueScrollTrackRef}
                          data-drag-exempt="true"
                          className="absolute top-3 right-2 bottom-3 w-3 touch-none"
                          onPointerDown={handleQueueScrollbarPointerDown}
                          onPointerMove={handleQueueScrollbarPointerMove}
                          onPointerUp={handleQueueScrollbarPointerUp}
                          onPointerCancel={handleQueueScrollbarPointerUp}
                          role="presentation"
                          aria-hidden="true"
                        >
                          <div className="absolute inset-0 rounded-full bg-[rgba(255,255,255,0.08)]" />
                          <motion.div
                            ref={queueScrollThumbRef}
                            data-queue-scroll-thumb="true"
                            className="absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-[rgba(255,255,255,0.5)]"
                            style={{ height: queueThumbHeight, y: queueThumbY }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {queue.length > 0 && (
                      <div className="border-t border-[var(--color-border)] p-4 text-sm text-[var(--color-subtext)]">
                        <div className="flex items-center justify-between">
                          <span>{tq("totalDuration")}</span>
                          <span className="font-medium">
                            {formatDuration(totalDuration)}
                          </span>
                        </div>
                        {queueSearchQuery &&
                          filteredQueue.length !== queue.length && (
                            <div className="mt-2 text-xs text-[var(--color-muted)]">
                              {tq("showingFiltered", {
                                visible: filteredQueue.length,
                                total: queue.length,
                              })}
                            </div>
                          )}
                        {!queueSearchQuery &&
                          selectedQueueIndices.size === 0 && (
                            <div className="mt-2 text-xs text-[var(--color-muted)]">
                              {tq("mobileSelectionTip")}
                            </div>
                          )}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {showQueueSettingsModal && (
              <QueueSettingsModal
                isOpen={showQueueSettingsModal}
                onClose={() => setShowQueueSettingsModal(false)}
                onApply={handleApplyQueueSettings}
                initialCount={smartTracksCount}
                initialSimilarityLevel={similarityLevel}
              />
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
