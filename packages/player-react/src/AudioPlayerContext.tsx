// File: packages/player-react/src/AudioPlayerContext.tsx

"use client";

import { useAudioPlayer } from "./useAudioPlayer";
import { useIsMobile } from "./useMediaQuery";
import { api } from "@starchild/api-client/trpc/react";
import type {
  QueuedTrack,
  SmartQueueSettings,
  SmartQueueState,
  Track,
} from "@starchild/types";
import {
  DEFAULT_STREAM_QUALITY,
  GUEST_STREAM_QUALITY,
  STREAM_QUALITY_OPTIONS,
  type StreamQuality,
} from "@starchild/types/settings";

// DB stores dates as strings
interface StoredQueuedTrack extends Omit<QueuedTrack, "addedAt"> {
  addedAt: string;
}
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AudioPlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  queuedTracks: QueuedTrack[];
  failedTrackIds: Set<number>;
  smartQueueState: SmartQueueState;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "none" | "one" | "all";
  isLoading: boolean;
  lastAutoQueueCount: number;
  showMobilePlayer: boolean;
  setShowMobilePlayer: (show: boolean) => void;
  hideUI: boolean;
  setHideUI: (hide: boolean) => void;

  audioElement: HTMLAudioElement | null;

  play: (track: Track) => void;
  playTrack: (track: Track) => void;
  togglePlay: () => Promise<void>;
  addToQueue: (track: Track | Track[], checkDuplicates?: boolean) => void;
  addToPlayNext: (track: Track | Track[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  playFromQueue: (index: number) => void;
  clearQueue: () => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  skipForward: () => void;
  skipBackward: () => void;

  saveQueueAsPlaylist: () => Promise<void>;

  removeDuplicates: () => void;
  cleanInvalidTracks: () => void;
  cleanQueue: () => void;
  clearQueueAndHistory: () => void;
  isValidTrack: (track: Track | null | undefined) => track is Track;

  addSmartTracks: (
    countOrOptions?:
      | number
      | { count: number; similarityLevel: "strict" | "balanced" | "diverse" },
  ) => Promise<Track[]>;
  refreshSmartTracks: () => Promise<void>;
  clearSmartTracks: () => void;
  getQueueSections: () => {
    userTracks: QueuedTrack[];
    smartTracks: QueuedTrack[];
  };
}

export const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined,
);

const isRepeatMode = (value: unknown): value is "none" | "one" | "all" =>
  value === "none" || value === "one" || value === "all";

const coerceRepeatMode = (value: unknown): "none" | "one" | "all" =>
  isRepeatMode(value) ? value : "none";

const isStreamQuality = (value: unknown): value is StreamQuality =>
  typeof value === "string" &&
  STREAM_QUALITY_OPTIONS.includes(value as StreamQuality);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return "Unknown error";
};

const coerceDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const normalizeSmartQueueState = (
  state: Partial<SmartQueueState> | null | undefined,
): SmartQueueState => ({
  isActive: Boolean(state?.isActive),
  lastRefreshedAt: coerceDate(state?.lastRefreshedAt),
  seedTrackId:
    typeof state?.seedTrackId === "number" ? state.seedTrackId : null,
  trackCount:
    typeof state?.trackCount === "number" && Number.isFinite(state.trackCount)
      ? state.trackCount
      : 0,
  isLoading:
    typeof state?.isLoading === "boolean" ? state.isLoading : false,
});

type ToastKind = "success" | "error" | "info" | "warning";

interface AudioPlayerProviderProps {
  children: ReactNode;
  onToast?: (message: string, type?: ToastKind, duration?: number) => void;
}

export function AudioPlayerProvider({
  children,
  onToast,
}: AudioPlayerProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated =
    sessionStatus === "authenticated" && Boolean(session?.user?.id);
  const optionalReadsDisabled =
    process.env.NEXT_PUBLIC_DB_OPTIONAL_READS_DISABLED === "true";
  const optionalWritesDisabled =
    process.env.NEXT_PUBLIC_DB_OPTIONAL_WRITES_DISABLED === "true";
  const isMobile = useIsMobile();
  const showToast = useCallback(
    (
      message: string,
      type: ToastKind = "info",
      duration = 3000,
    ) => {
      if (onToast) {
        onToast(message, type, duration);
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("starchild:toast", {
            detail: { message, type, duration },
          }),
        );
        return;
      }

      const prefix = `[AudioPlayerContext:${type}]`;
      if (type === "error") {
        console.error(prefix, message);
      } else {
        console.warn(prefix, message);
      }
    },
    [onToast],
  );
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const addToHistory = api.music.addToHistory.useMutation();
  const createPlaylistMutation = api.music.createPlaylist.useMutation();
  const addToPlaylistMutation = api.music.addToPlaylist.useMutation();
  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    { enabled: isAuthenticated && !optionalReadsDisabled },
  );
  const resumeErrorThrottleRef = useRef(0);
  const queuePersistenceErrorThrottleRef = useRef(0);
  const logQueuePersistenceWarning = useCallback(
    (operation: "save" | "clear", error: unknown) => {
      const now = Date.now();
      if (now - queuePersistenceErrorThrottleRef.current < 8000) return;
      queuePersistenceErrorThrottleRef.current = now;

      console.warn(
        `[AudioPlayerContext] Failed to ${operation} queue state:`,
        getErrorMessage(error),
        error,
      );
    },
    [],
  );
  const handleBackgroundResumeError = useCallback(
    (reason: string, error?: unknown) => {
      const now = Date.now();
      if (now - resumeErrorThrottleRef.current < 8000) return;
      resumeErrorThrottleRef.current = now;
      showToast(
        "Background playback was interrupted. Tap play to resume.",
        "warning",
      );
      console.warn(
        `[AudioPlayerContext] Background resume failed (${reason})`,
        error,
      );
    },
    [showToast],
  );

  const saveQueueStateMutation = api.music.saveQueueState.useMutation({
    onError: (error) => {
      logQueuePersistenceWarning("save", error);
    },
  });
  const clearQueueStateMutation = api.music.clearQueueState.useMutation({
    onError: (error) => {
      logQueuePersistenceWarning("clear", error);
    },
  });
  const { data: dbQueueState } = api.music.getQueueState.useQuery(undefined, {
    enabled: isAuthenticated && !optionalReadsDisabled,
    refetchOnWindowFocus: false,
  });

  const { data: smartQueueSettings } = api.music.getSmartQueueSettings.useQuery(
    undefined,
    { enabled: isAuthenticated && !optionalReadsDisabled },
  );
  const normalizedSmartQueueSettings = smartQueueSettings
    ? (() => {
        const smartQueueSettingsWithExtras =
          smartQueueSettings as Partial<SmartQueueSettings>;
        return {
          ...smartQueueSettings,
          diversityFactor: smartQueueSettingsWithExtras.diversityFactor ?? 0.5,
          excludeExplicit:
            smartQueueSettingsWithExtras.excludeExplicit ?? false,
          preferLiveVersions:
            smartQueueSettingsWithExtras.preferLiveVersions ?? false,
        } as SmartQueueSettings;
      })()
    : undefined;

  const utils = api.useUtils();

  const hasCompleteTrackData = (
    track: Track | null | undefined,
  ): boolean => {
    if (!track) return false;

    const hasArtist =
      typeof track.artist?.id === "number" &&
      track.artist.id > 0 &&
      typeof track.artist?.name === "string" &&
      track.artist.name.length > 0 &&
      track.artist.type === "artist";

    const hasAlbum =
      typeof track.album?.id === "number" &&
      track.album.id > 0 &&
      typeof track.album?.title === "string" &&
      track.album.title.length > 0 &&
      typeof track.album.cover === "string" &&
      typeof track.album.cover_small === "string" &&
      typeof track.album.cover_medium === "string" &&
      typeof track.album.cover_big === "string" &&
      typeof track.album.cover_xl === "string" &&
      typeof track.album.md5_image === "string" &&
      typeof track.album.tracklist === "string" &&
      track.album.type === "album";

    return (
      typeof track.id === "number" &&
      track.id > 0 &&
      typeof track.readable === "boolean" &&
      typeof track.title === "string" &&
      track.title.length > 0 &&
      typeof track.title_short === "string" &&
      track.title_short.length > 0 &&
      typeof track.link === "string" &&
      track.link.length > 0 &&
      typeof track.duration === "number" &&
      track.duration > 0 &&
      typeof track.rank === "number" &&
      typeof track.explicit_lyrics === "boolean" &&
      typeof track.explicit_content_lyrics === "number" &&
      typeof track.explicit_content_cover === "number" &&
      typeof track.preview === "string" &&
      typeof track.md5_image === "string" &&
      track.type === "track" &&
      hasArtist &&
      hasAlbum
    );
  };

  const DEFAULT_MAX_SEEDS = 30;
  const DEFAULT_SAMPLING = "evenly-spaced";
  const DEFAULT_QUEUE_MODE = "useQueueOnly";

  const buildSeedTracks = (
    currentTrack: Track,
    queue: Track[] | undefined,
    history: Track[] | undefined,
    options?: { includeHistory?: boolean },
  ): Array<{ name: string; artist?: string; album?: string }> => {
    const maxHistorySeeds = 4;
    const includeHistory = options?.includeHistory ?? true;
    const recentHistory = includeHistory
      ? (history ?? []).slice(-maxHistorySeeds).reverse()
      : [];
    const queueTracks = queue ?? [];
    const candidates =
      queueTracks.length > 0
        ? [...queueTracks, ...recentHistory]
        : [currentTrack, ...recentHistory];
    const seen = new Set<number>();
    const seeds: Array<{ name: string; artist?: string; album?: string }> = [];

    for (const track of candidates) {
      if (!track || typeof track.id !== "number") continue;
      if (seen.has(track.id)) continue;
      if (!track.title || !track.artist?.name) continue;

      seen.add(track.id);
      seeds.push({
        name: track.title,
        artist: track.artist.name,
        album: track.album?.title,
      });
    }

    const [firstSeed] = seeds;
    if (seeds.length === 1 && firstSeed?.name) {
      seeds.push({
        name: firstSeed.name,
        artist: firstSeed.artist,
        album: firstSeed.album,
      });
    }

    return seeds;
  };

  const buildExcludeIds = (
    currentTrack: Track,
    queue: Track[] | undefined,
    history: Track[] | undefined,
  ): { deezerIds: number[]; spotifyIds: string[] } => {
    const deezerIds = new Set<number>();
    const spotifyIds = new Set<string>();
    const maxExcluded = 150;

    if (typeof currentTrack.id === "number") {
      deezerIds.add(currentTrack.id);
    }
    if (typeof currentTrack.spotify_id === "string") {
      spotifyIds.add(currentTrack.spotify_id);
    }

    for (const track of queue ?? []) {
      if (typeof track?.id === "number") {
        deezerIds.add(track.id);
      }
      if (typeof track?.spotify_id === "string") {
        spotifyIds.add(track.spotify_id);
      }
      if (deezerIds.size >= maxExcluded) break;
    }

    if (deezerIds.size < maxExcluded) {
      for (const track of history ?? []) {
        if (typeof track?.id === "number") {
          deezerIds.add(track.id);
        }
        if (typeof track?.spotify_id === "string") {
          spotifyIds.add(track.spotify_id);
        }
        if (deezerIds.size >= maxExcluded) break;
      }
    }

    return {
      deezerIds: Array.from(deezerIds),
      spotifyIds: Array.from(spotifyIds),
    };
  };

  const handleAutoQueueTrigger = useCallback(
    async (
      currentTrack: Track,
      _queueLength: number,
      context?: { history: Track[]; queue: Track[]; source: "auto" | "manual" },
    ): Promise<Track[]> => {
      try {
        const similarityLevel =
          context?.source === "auto"
            ? "diverse"
            : (normalizedSmartQueueSettings?.similarityPreference ??
              "balanced");
        const recommendationSource =
          context?.source === "auto" ? "unified" : "spotify";
        const seedTracks = buildSeedTracks(
          currentTrack,
          context?.queue,
          context?.history,
          { includeHistory: DEFAULT_QUEUE_MODE !== "useQueueOnly" },
        );
        const maxSeeds = Math.max(
          2,
          Math.min(seedTracks.length, DEFAULT_MAX_SEEDS),
        );
        const excludeIds = buildExcludeIds(
          currentTrack,
          context?.queue,
          context?.history,
        );
        const result = await utils.music.getSimilarTracks.fetch({
          trackId: currentTrack.id,
          limit: 10,
          useEnhanced: true,
          similarityLevel,
          excludeExplicit: normalizedSmartQueueSettings?.excludeExplicit,
          recommendationSource,
          maxSeeds,
          sampling: DEFAULT_SAMPLING,
          queueMode: DEFAULT_QUEUE_MODE,
          ...(excludeIds.deezerIds.length > 0
            ? { excludeTrackIds: excludeIds.deezerIds }
            : {}),
          ...(excludeIds.spotifyIds.length > 0
            ? { excludeSpotifyTrackIds: excludeIds.spotifyIds }
            : {}),
          seedTracks,
        });

        return result || [];
      } catch (error) {
        console.error(
          "[AudioPlayerContext] Failed to fetch similar tracks:",
          error,
        );
        return [];
      }
    },
    [normalizedSmartQueueSettings, utils],
  );

  const handleCustomSmartTracksFetch = useCallback(
    async (
      currentTrack: Track,
      options: {
        count: number;
        similarityLevel: "strict" | "balanced" | "diverse";
      },
      context?: { history: Track[]; queue: Track[] },
    ): Promise<Track[]> => {
      try {
        const seedTracks = buildSeedTracks(
          currentTrack,
          context?.queue,
          context?.history,
          { includeHistory: DEFAULT_QUEUE_MODE !== "useQueueOnly" },
        );
        const maxSeeds = Math.max(
          2,
          Math.min(seedTracks.length, DEFAULT_MAX_SEEDS),
        );
        const excludeIds = buildExcludeIds(
          currentTrack,
          context?.queue,
          context?.history,
        );
        const result = await utils.music.getSimilarTracks.fetch({
          trackId: currentTrack.id,
          limit: options.count,
          useEnhanced: true,
          similarityLevel: options.similarityLevel,
          excludeExplicit: normalizedSmartQueueSettings?.excludeExplicit,
          recommendationSource: "spotify",
          maxSeeds,
          sampling: DEFAULT_SAMPLING,
          queueMode: DEFAULT_QUEUE_MODE,
          ...(excludeIds.deezerIds.length > 0
            ? { excludeTrackIds: excludeIds.deezerIds }
            : {}),
          ...(excludeIds.spotifyIds.length > 0
            ? { excludeSpotifyTrackIds: excludeIds.spotifyIds }
            : {}),
          seedTracks,
        });

        return result || [];
      } catch (error) {
        console.error(
          "[AudioPlayerContext] Failed to fetch custom smart tracks:",
          error,
        );
        return [];
      }
    },
    [normalizedSmartQueueSettings, utils],
  );

  const initialQueueState = useMemo(() => {
    if (!session?.user?.id || !dbQueueState?.queuedTracks) {
      return undefined;
    }

    if (dbQueueState.queuedTracks.length === 0) {
      return undefined;
    }

    const normalizedSmartQueueState = normalizeSmartQueueState(
      dbQueueState.smartQueueState as Partial<SmartQueueState> | undefined,
    );

    return {
      queuedTracks: (dbQueueState.queuedTracks as StoredQueuedTrack[]).map(
        (qt) => ({
          ...qt,
          addedAt: new Date(qt.addedAt),
        }),
      ) as QueuedTrack[],
      smartQueueState: normalizedSmartQueueState,
      history: (dbQueueState.history || []) as Track[],
      isShuffled: dbQueueState.isShuffled ?? false,
      repeatMode: coerceRepeatMode(dbQueueState.repeatMode),
    };
  }, [
    session?.user?.id,
    dbQueueState?.queuedTracks,
    dbQueueState?.smartQueueState,
    dbQueueState?.history,
    dbQueueState?.isShuffled,
    dbQueueState?.repeatMode,
  ]);

  const player = useAudioPlayer({
    initialQueueState: initialQueueState,
    keepPlaybackAlive: preferences?.keepPlaybackAlive ?? true,
    streamQuality: isAuthenticated
      ? isStreamQuality(preferences?.streamQuality)
        ? preferences.streamQuality
        : DEFAULT_STREAM_QUALITY
      : GUEST_STREAM_QUALITY,
    onBackgroundResumeError: handleBackgroundResumeError,
    onTrackChange: (track) => {
      if (track && isAuthenticated && !optionalWritesDisabled) {
        if (hasCompleteTrackData(track)) {
          addToHistory.mutate(
            {
              track,
              duration:
                typeof track.duration === "number" ? track.duration : undefined,
            },
            {
              onError: (error) => {
                console.warn(
                  "[AudioPlayerContext] Failed to add track to history:",
                  getErrorMessage(error),
                  { trackId: track.id, trackTitle: track.title },
                );
              },
            },
          );
        } else {
          console.warn(
            "[AudioPlayerContext] ⚠️ Skipping addToHistory due to incomplete track data",
            {
              trackId: track.id,
            },
          );
        }
      }
    },
    onAutoQueueTrigger: handleAutoQueueTrigger,
    onCustomSmartTracksFetch: handleCustomSmartTracksFetch,
    onError: (error, trackId) => {
      console.error(
        `[AudioPlayerContext] Playback error for track ${trackId}:`,
        error,
      );

      if (
        error.includes("upstream error") ||
        error.includes("ServiceUnavailableException")
      ) {
        showToast(
          "Music service temporarily unavailable. The backend cannot reach the music source. Please try again in a moment.",
          "error",
        );
      } else if (
        error.includes("502") ||
        error.includes("504") ||
        error.includes("Bad Gateway") ||
        error.includes("Gateway Timeout")
      ) {
        showToast(
          "Streaming gateway error. Please try again in a moment.",
          "error",
        );
      } else if (
        error.includes("503") ||
        error.includes("Service Unavailable")
      ) {
        showToast(
          "Streaming service unavailable. Please try again later.",
          "error",
        );
      } else {
        showToast("Playback failed. Please try again.", "error");
      }
    },
    smartQueueSettings: normalizedSmartQueueSettings,
  });

  useEffect(() => {
    if (!isAuthenticated || optionalWritesDisabled) return;

    const persistTimer = setTimeout(() => {
      const queuedTracksForSave: Array<{
        track: Track;
        queueId: string;
        queueSource: "user" | "smart";
        addedAt: string;
      }> = player.queuedTracks.map((qt) => ({
        track: qt.track,
        queueId: qt.queueId,
        queueSource: qt.queueSource === "smart" ? "smart" : "user",
        addedAt:
          qt.addedAt instanceof Date
            ? qt.addedAt.toISOString()
            : String(qt.addedAt),
      }));
      const queueState = {
        version: 2 as const,
        queuedTracks: queuedTracksForSave,
        smartQueueState: (() => {
          const normalizedState = normalizeSmartQueueState(
            player.smartQueueState,
          );
          return {
            isActive: normalizedState.isActive,
            lastRefreshedAt: normalizedState.lastRefreshedAt
              ? normalizedState.lastRefreshedAt.toISOString()
              : null,
            seedTrackId: normalizedState.seedTrackId,
            trackCount: normalizedState.trackCount,
          };
        })(),
        history: player.history,
        currentTime: player.currentTime,
        isShuffled: player.isShuffled,
        repeatMode: player.repeatMode,
      };

      if (queueState.queuedTracks.length === 0) {
        console.log(
          "[AudioPlayerContext] 🧹 Clearing queue state from database",
        );
        clearQueueStateMutation.mutate();
      } else {
        console.log(
          "[AudioPlayerContext] 💾 Persisting queue state to database",
        );
        saveQueueStateMutation.mutate({ queueState });
      }
    }, 1000);

    return () => clearTimeout(persistTimer);
  }, [
    isAuthenticated,
    player.queuedTracks,
    player.smartQueueState,
    player.history,
    player.isShuffled,
    player.repeatMode,
    optionalWritesDisabled,
  ]);

  useEffect(() => {
    const currentUserId = session?.user?.id ?? null;

    if (lastUserId !== null && currentUserId !== lastUserId) {
      console.log(
        "[AudioPlayerContext] 🔄 User session changed, clearing queue",
        {
          from: lastUserId,
          to: currentUserId,
        },
      );
      player.clearQueueAndHistory();

      if (currentUserId && isAuthenticated && !optionalWritesDisabled) {
        clearQueueStateMutation.mutate();
      }

      showToast(
        currentUserId
          ? "Welcome! Queue has been cleared for your new session."
          : "Logged out. Queue cleared.",
        "info",
      );
    }

    setLastUserId(currentUserId);
  }, [
    session?.user?.id,
    isAuthenticated,
    lastUserId,
    optionalWritesDisabled,
  ]);

  useEffect(() => {
    const cleanupInterval = setInterval(
      () => {
        if (player.queue.length > 1) {
          console.log("[AudioPlayerContext] 🧹 Running periodic queue cleanup");
          player.cleanQueue();
        }
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(cleanupInterval);
  }, [player]);

  const play = useCallback(
    (track: Track) => {
      player.playTrack(track);

      if (isMobile) {
        setShowMobilePlayer(true);
      }
    },
    [player, isMobile],
  );

  const playTrack = useCallback(
    (track: Track) => {
      play(track);
    },
    [play],
  );

  const playNext = useCallback(() => {
    player.playNext();
  }, [player]);

  const playPrevious = useCallback(() => {
    player.playPrevious();
  }, [player]);

  const playFromQueue = useCallback(
    (index: number) => {
      player.playFromQueue(index);
    },
    [player],
  );

  const saveQueueAsPlaylist = useCallback(async () => {
    console.log("[AudioPlayerContext] 💾 saveQueueAsPlaylist called", {
      hasSession: isAuthenticated,
      currentTrack: player.currentTrack ? player.currentTrack.title : null,
      queueSize: player.queue.length,
    });

    if (!isAuthenticated) {
      showToast("Sign in to save playlists", "info");
      return;
    }

    const tracksToSave: Track[] = [...player.queue];

    if (tracksToSave.length === 0) {
      showToast("Queue is empty", "info");
      return;
    }

    const defaultName = player.currentTrack
      ? `${player.currentTrack.title} Queue`
      : `Queue ${new Date().toLocaleDateString()}`;
    const playlistName = prompt("Name your new playlist", defaultName);

    if (playlistName === null) {
      console.log(
        "[AudioPlayerContext] ⚪ Playlist creation cancelled by user",
      );
      return;
    }

    const trimmedName = playlistName.trim();

    if (!trimmedName) {
      showToast("Playlist name cannot be empty", "error");
      return;
    }

    showToast("Saving queue as playlist...", "info");

    try {
      const playlist = await createPlaylistMutation.mutateAsync({
        name: trimmedName,
        isPublic: false,
      });

      if (!playlist) {
        throw new Error("Playlist creation returned no data");
      }

      console.log(
        `[AudioPlayerContext] 💾 Adding ${tracksToSave.length} tracks to playlist ${playlist.id}`,
      );

      await Promise.all(
        tracksToSave.map((track, index) => {
          console.log(
            `[AudioPlayerContext] 💾 Adding track ${index + 1}/${tracksToSave.length}: ${track.title}`,
          );
          return addToPlaylistMutation.mutateAsync({
            playlistId: playlist.id,
            track,
          });
        }),
      );

      console.log(
        `[AudioPlayerContext] ✅ Successfully added all ${tracksToSave.length} tracks`,
      );

      showToast(
        `Saved ${tracksToSave.length} track${tracksToSave.length === 1 ? "" : "s"} to "${trimmedName}"`,
        "success",
      );
      void utils.music.getPlaylists.invalidate();
    } catch (error) {
      console.error(
        "[AudioPlayerContext] ❌ Failed to save queue as playlist:",
        error,
      );
      showToast("Failed to save playlist", "error");
    }
  }, [
    isAuthenticated,
    player,
    createPlaylistMutation,
    addToPlaylistMutation,
    showToast,
    utils,
  ]);

  const value: AudioPlayerContextType = useMemo(
    () => ({
      currentTrack: player.currentTrack,
      queue: player.queue,
      queuedTracks: player.queuedTracks,
      failedTrackIds: player.failedTrackIds,
      smartQueueState: player.smartQueueState,
      isPlaying: player.isPlaying,
      currentTime: player.currentTime,
      duration: player.duration,
      volume: player.volume,
      isMuted: player.isMuted,
      isShuffled: player.isShuffled,
      repeatMode: player.repeatMode,
      isLoading: player.isLoading,
      lastAutoQueueCount: player.smartQueueState.trackCount,
      showMobilePlayer,
      setShowMobilePlayer,
      hideUI,
      setHideUI,

      audioElement: player.audioElement,

      play,
      playTrack,
      togglePlay: player.togglePlay,
      addToQueue: player.addToQueue,
      addToPlayNext: player.addToPlayNext,
      playNext,
      playPrevious,
      playFromQueue,
      clearQueue: player.clearQueue,
      removeFromQueue: player.removeFromQueue,
      reorderQueue: player.reorderQueue,
      seek: player.seek,
      setVolume: player.setVolume,
      setIsMuted: player.setIsMuted,
      toggleShuffle: player.toggleShuffle,
      cycleRepeatMode: player.cycleRepeatMode,
      skipForward: player.skipForward,
      skipBackward: player.skipBackward,

      saveQueueAsPlaylist,

      removeDuplicates: player.removeDuplicates,
      cleanInvalidTracks: player.cleanInvalidTracks,
      cleanQueue: player.cleanQueue,
      clearQueueAndHistory: player.clearQueueAndHistory,
      isValidTrack: player.isValidTrack,

      addSmartTracks: player.addSmartTracks,
      refreshSmartTracks: player.refreshSmartTracks,
      clearSmartTracks: player.clearSmartTracks,
      getQueueSections: player.getQueueSections,
    }),
    [
      player.currentTrack,
      player.queue,
      player.queuedTracks,
      player.failedTrackIds,
      player.smartQueueState,
      player.isPlaying,
      player.currentTime,
      player.duration,
      player.volume,
      player.isMuted,
      player.isShuffled,
      player.repeatMode,
      player.isLoading,
      showMobilePlayer,
      hideUI,
      player.audioElement,
      play,
      playTrack,
      player.togglePlay,
      player.addToQueue,
      player.addToPlayNext,
      playNext,
      playPrevious,
      playFromQueue,
      player.clearQueue,
      player.removeFromQueue,
      player.reorderQueue,
      player.seek,
      player.setVolume,
      player.setIsMuted,
      player.toggleShuffle,
      player.cycleRepeatMode,
      player.skipForward,
      player.skipBackward,
      saveQueueAsPlaylist,
      player.removeDuplicates,
      player.cleanInvalidTracks,
      player.cleanQueue,
      player.clearQueueAndHistory,
      player.isValidTrack,
      player.addSmartTracks,
      player.refreshSmartTracks,
      player.clearSmartTracks,
      player.getQueueSections,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error(
      "useGlobalPlayer must be used within an AudioPlayerProvider",
    );
  }
  return context;
}
