// File: packages/player-react/src/useAudioPlayer.ts

"use client";

import { AUDIO_CONSTANTS } from "@starchild/config/constants";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { localStorage } from "./storageService";
import type {
  QueuedTrack,
  SmartQueueSettings,
  SmartQueueState,
  Track,
} from "@starchild/types";
import { getStreamUrlById } from "@starchild/api-client/rest";
import {
  getAudioConnection,
  ensureConnectionChain,
  verifyConnectionChain,
} from "@starchild/audio-adapters";
import { logger } from "./logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedQueueState,
  loadPersistedQueueState,
} from "./useQueuePersistence";

type RepeatMode = "none" | "one" | "all";

const DEFAULT_VOLUME = 0.7;
const SMART_TRACKS_CACHE_DURATION_MS = 60_000;
const KEEP_ALIVE_INTERVAL_MS = 25_000;
const STATE_SYNC_INTERVAL_MS = 500;
const STATE_SYNC_DEBOUNCE_MS = 200;
const MIN_HISTORY_FOR_AUTO_QUEUE = 2;
const PREVIOUS_TRACK_RESTART_THRESHOLD_SEC = 3;
const AUTO_PLAY_DELAY_MS = 150;
const DEFAULT_AUTO_QUEUE_COUNT = 5;

const normalizeStoredVolume = (value: unknown): number => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return DEFAULT_VOLUME;

  if (numericValue > 1) {
    if (numericValue <= 100 && Number.isInteger(numericValue)) {
      return Math.max(0, Math.min(1, numericValue / 100));
    }
    return 1;
  }

  return Math.max(0, Math.min(1, numericValue));
};

interface UseAudioPlayerOptions {
  onTrackChange?: (track: Track) => void;
  onTrackEnd?: (track: Track) => void;
  onDuplicateTrack?: (track: Track) => void;
  onAutoQueueTrigger?: (
    currentTrack: Track,
    currentQueueLength: number,
    context?: {
      history: Track[];
      queue: Track[];
      seedQueue?: Track[];
      source: "auto" | "manual";
    },
  ) => Promise<Track[]>;
  onCustomSmartTracksFetch?: (
    currentTrack: Track,
    options: {
      count: number;
      similarityLevel: "strict" | "balanced" | "diverse";
    },
    context?: {
      history: Track[];
      queue: Track[];
      seedQueue?: Track[];
    },
  ) => Promise<Track[]>;
  onError?: (error: string, trackId?: number) => void;
  keepPlaybackAlive?: boolean;
  onBackgroundResumeError?: (reason: string, error: unknown) => void;
  smartQueueSettings?: SmartQueueSettings;
  initialQueueState?: {
    queuedTracks: QueuedTrack[];
    smartQueueState: SmartQueueState;
    history: Track[];
    isShuffled: boolean;
    repeatMode: RepeatMode;
  } | null;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const {
    onTrackChange,
    onTrackEnd,
    onDuplicateTrack,
    onError,
    keepPlaybackAlive = true,
    onBackgroundResumeError,
    initialQueueState,
  } = options;

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queuedTracks, setQueuedTracks] = useState<QueuedTrack[]>([]);
  const [smartQueueState, setSmartQueueState] = useState<SmartQueueState>({
    isActive: false,
    lastRefreshedAt: null,
    seedTrackId: null,
    trackCount: 0,
    isLoading: false,
  });

  const [history, setHistory] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [isLoading, setIsLoading] = useState(false);
  const originalQueueOrderRef = useRef<QueuedTrack[]>([]);
  const loadIdRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const streamErrorRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamErrorRetryCountRef = useRef(0);
  const streamErrorTrackIdRef = useRef<number | null>(null);
  const maxStreamErrorRetries = 2;
  const lastDebugTimeBucketRef = useRef<number | null>(null);
  const failedTracksRef = useRef<Set<number>>(new Set());
  const [failedTrackIds, setFailedTrackIds] = useState<Set<number>>(new Set());
  const isInitialMountRef = useRef(true);
  const isPlayPauseOperationRef = useRef(false);
  const lastStateSyncRef = useRef<{ time: number; wasPlaying: boolean } | null>(
    null,
  );
  const isPlayingRef = useRef(isPlaying);
  const shouldResumeOnFocusRef = useRef(false);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedTrackIdRef = useRef<number | null>(null);
  const shouldAutoPlayNextRef = useRef(false);
  const queueRef = useRef<QueuedTrack[]>([]);
  const loadTrackRef = useRef<
    ((track: Track, streamUrl: string) => void) | null
  >(null);
  const playRef = useRef<(() => Promise<void>) | null>(null);
  const requestAutoPlayNext = useCallback((force = false) => {
    if (force || isPlayingRef.current) {
      shouldAutoPlayNextRef.current = true;
    }
  }, []);

  const queue = useMemo(
    () => queuedTracks.map((qt) => qt.track),
    [queuedTracks],
  );
  const currentTrack = queue[0] ?? null;

  useEffect(() => {
    queueRef.current = queuedTracks;
  }, [queuedTracks]);

  const generateQueueId = useCallback(() => {
    return `queue-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const createQueuedTrack = useCallback(
    (track: Track, source: "user" | "smart"): QueuedTrack => {
      return {
        track,
        queueSource: source,
        addedAt: new Date(),
        queueId: generateQueueId(),
      };
    },
    [generateQueueId],
  );

  const getQueueSections = useCallback(() => {
    const userTracks: QueuedTrack[] = [];
    const smartTracks: QueuedTrack[] = [];

    queuedTracks.slice(1).forEach((qt) => {
      if (qt.queueSource === "smart") {
        smartTracks.push(qt);
      } else {
        userTracks.push(qt);
      }
    });

    return { userTracks, smartTracks };
  }, [queuedTracks]);

  useEffect(() => {
    const savedVolume = localStorage.getOrDefault(
      STORAGE_KEYS.VOLUME,
      DEFAULT_VOLUME,
    );

    setVolume(normalizeStoredVolume(savedVolume));

    if (initialQueueState && initialQueueState.queuedTracks.length > 0) {
      logger.info("[useAudioPlayer] 📥 Restoring queue state from database");
      setQueuedTracks(initialQueueState.queuedTracks);
      setSmartQueueState({
        ...initialQueueState.smartQueueState,
        isLoading: false,
      });
      setHistory(initialQueueState.history);
      setIsShuffled(initialQueueState.isShuffled);
      setRepeatMode(initialQueueState.repeatMode);
      return;
    }

    const persistedState = loadPersistedQueueState();
    if (persistedState) {
      interface PersistedStateV2 {
        version: 2;
        queuedTracks: QueuedTrack[];
        smartQueueState?: SmartQueueState;
        history: Track[];
        isShuffled: boolean;
        repeatMode: RepeatMode;
        currentTime: number;
      }

      const isV2State = (state: unknown): state is PersistedStateV2 => {
        return (
          typeof state === "object" &&
          state !== null &&
          "queuedTracks" in state &&
          Array.isArray(state.queuedTracks)
        );
      };

      const hasQueuedTracks =
        isV2State(persistedState) && persistedState.queuedTracks.length > 0;
      const hasLegacyQueue =
        "queue" in persistedState &&
        Array.isArray(persistedState.queue) &&
        persistedState.queue.length > 0;

      if (hasQueuedTracks || hasLegacyQueue) {
        if (isV2State(persistedState)) {
          setQueuedTracks(persistedState.queuedTracks);
          if (persistedState.smartQueueState) {
            setSmartQueueState({
              ...persistedState.smartQueueState,
              isLoading: false,
            });
          }
        } else if ("queue" in persistedState && persistedState.queue) {
          const migratedTracks = persistedState.queue.map((track, idx) => ({
            track,
            queueSource: "user" as const,
            addedAt: new Date(),
            queueId: `migrated-${track.id}-${idx}`,
          }));
          setQueuedTracks(migratedTracks);
        }
        setHistory(persistedState.history);
        setIsShuffled(persistedState.isShuffled);
        setRepeatMode(persistedState.repeatMode);
      } else {
        logger.debug(
          "[useAudioPlayer] Queue was cleared, not restoring from persistence",
        );
      }
    }
  }, [initialQueueState]);

  useEffect(() => {
    localStorage.set(STORAGE_KEYS.VOLUME, volume);
  }, [volume]);

  useEffect(() => {
    const queueState = {
      version: 2 as const,
      queuedTracks,
      smartQueueState,
      history,
      currentTime,
      isShuffled,
      repeatMode,
    };
    localStorage.set(STORAGE_KEYS.QUEUE_STATE, queueState);
  }, [
    queuedTracks,
    smartQueueState,
    history,
    currentTime,
    isShuffled,
    repeatMode,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = "auto";
      audioRef.current.playbackRate = 1;
      audioRef.current.defaultPlaybackRate = 1;

      const preserve = audioRef.current as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      preserve.preservesPitch = true;
      preserve.webkitPreservesPitch = true;

      audioRef.current.setAttribute("x5-playsinline", "true");
      audioRef.current.setAttribute("webkit-playsinline", "true");
      audioRef.current.setAttribute("playsinline", "true");
      audioRef.current.setAttribute("aria-hidden", "true");
      audioRef.current.setAttribute("data-audio-element", "global-player");
      audioRef.current.style.display = "none";

      if (!audioRef.current.isConnected) {
        document.body.appendChild(audioRef.current);
      }
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      const targetVolume = isMuted ? 0 : volume;
      const connection = getAudioConnection(audioRef.current);

      if (connection?.gainNode) {
        connection.gainNode.gain.value = targetVolume;
        if (audioRef.current.volume !== 1) {
          audioRef.current.volume = 1;
        }
      } else {
        audioRef.current.volume = targetVolume;
      }
    }
  }, [volume, isMuted]);

  const handleTrackEnd = useCallback(async () => {
    if (!currentTrack) return;

    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          logger.error(
            "[useAudioPlayer] Failed to restart track in repeat-one mode:",
            err,
          );
          setIsPlaying(false);
        });
      }
      return;
    }

    if (queuedTracks.length > 1) {
      // Move to next track in queue
      requestAutoPlayNext(true);
      setHistory((prev) => [...prev, currentTrack]);
      setQueuedTracks((prev) => prev.slice(1));
    } else if (repeatMode === "all") {
      // Repeat all tracks from history
      if (history.length > 0) {
        requestAutoPlayNext(true);
        const allTracks = [...history, currentTrack];
        const newQueuedTracks = allTracks.map((track, idx) => ({
          track,
          queueSource: "user" as const,
          addedAt: new Date(),
          queueId: `repeat-${track.id}-${idx}`,
        }));
        setQueuedTracks(newQueuedTracks);
        setHistory([]);
      }
    } else {
      // Last track in queue - keep it in the queue so the player UI remains visible
      // Add to history but don't remove from queue
      setHistory((prev) => [...prev, currentTrack]);

      // Queue is running out - check if we should generate smart tracks
      // Require at least 2 tracks in history to make decent recommendations
      const hasEnoughHistory = history.length >= MIN_HISTORY_FOR_AUTO_QUEUE;

      const shouldAutoQueue =
        optionsRef.current.smartQueueSettings?.autoQueueEnabled &&
        optionsRef.current.onAutoQueueTrigger &&
        currentTrack &&
        hasEnoughHistory;

      if (shouldAutoQueue) {
        logger.debug(
          "[useAudioPlayer] 🎵 Queue running low, generating smart tracks based on listening history...",
          { historySize: history.length },
        );

        try {
          // Generate smart tracks based on current track and listening history
          const queueTracks = queuedTracks.map((qt) => qt.track);
          const seedQueueTracks = queuedTracks
            .filter((qt) => qt.queueSource !== "smart")
            .map((qt) => qt.track);
          const onAutoQueueTrigger = optionsRef.current.onAutoQueueTrigger;
          if (!onAutoQueueTrigger) return;

          const recommendedTracks = await onAutoQueueTrigger(
            currentTrack,
            queuedTracks.length,
            {
              history,
              queue: queueTracks,
              seedQueue: seedQueueTracks,
              source: "auto",
            },
          );

          if (recommendedTracks.length > 0) {
            const count =
              optionsRef.current.smartQueueSettings?.autoQueueCount ??
              DEFAULT_AUTO_QUEUE_COUNT;
            const tracksToAdd = recommendedTracks.slice(0, count);
            const smartQueuedTracks = tracksToAdd.map((t) =>
              createQueuedTrack(t, "smart"),
            );

            // Clear current queue (which only has the ending track) and add smart tracks
            setQueuedTracks(smartQueuedTracks);
            setSmartQueueState({
              isActive: true,
              lastRefreshedAt: new Date(),
              seedTrackId: currentTrack.id,
              trackCount: smartQueuedTracks.length,
              isLoading: false,
            });

            logger.debug(
              `[useAudioPlayer] ✅ Generated ${smartQueuedTracks.length} smart tracks, auto-transition will happen`,
            );

            // Flag that we should auto-play the next track
            requestAutoPlayNext(true);

            return;
          } else {
            logger.warn(
              "[useAudioPlayer] ⚠️ No smart tracks generated, queue will end",
            );
          }
        } catch (error) {
          logger.error(
            "[useAudioPlayer] ❌ Failed to generate smart tracks:",
            error,
          );
        }
      } else if (
        optionsRef.current.smartQueueSettings?.autoQueueEnabled &&
        !hasEnoughHistory
      ) {
        logger.debug(
          "[useAudioPlayer] ⏸️ Auto-queue skipped: need at least 2 tracks in history for good recommendations",
          { historySize: history.length },
        );
      }

      // If auto-queue failed or is disabled, end playback
      onTrackEnd?.(currentTrack);

      // Don't clear the queue - keep the last track so the player UI remains visible
      // This prevents the player from disappearing when the queue finishes
      // The user can still see the last played track and interact with the player
      setIsPlaying(false);
      logger.debug(
        "[useAudioPlayer] 🏁 Playback ended, keeping last track in queue for UI",
      );
    }
  }, [
    currentTrack,
    queuedTracks,
    repeatMode,
    history,
    onTrackEnd,
    createQueuedTrack,
    requestAutoPlayNext,
  ]);

  // Monitor queue length and trigger auto-queue when running low
  useEffect(() => {
    const smartQueueSettings = optionsRef.current.smartQueueSettings;
    const onAutoQueueTrigger = optionsRef.current.onAutoQueueTrigger;

    const shouldAutoQueue =
      smartQueueSettings?.autoQueueEnabled &&
      onAutoQueueTrigger &&
      currentTrack &&
      isPlaying &&
      !smartQueueState.isLoading;

    if (!shouldAutoQueue || !smartQueueSettings || !onAutoQueueTrigger) return;

    const threshold = smartQueueSettings.autoQueueThreshold ?? 3;
    const remainingTracks = queuedTracks.length - 1; // Exclude current track

    // Trigger auto-queue when queue drops to or below threshold
    if (remainingTracks <= threshold && remainingTracks >= 0) {
      // Check if we already have smart tracks for this seed track
      const hasRecentSmartTracks =
        smartQueueState.isActive &&
        smartQueueState.seedTrackId === currentTrack.id &&
        smartQueueState.lastRefreshedAt &&
        Date.now() - new Date(smartQueueState.lastRefreshedAt).getTime() <
          SMART_TRACKS_CACHE_DURATION_MS;

      if (!hasRecentSmartTracks) {
        logger.debug(
          `[useAudioPlayer] 🎵 Queue running low (${remainingTracks} tracks remaining), generating smart tracks...`,
        );

        void (async () => {
          try {
            setSmartQueueState((prev) => ({ ...prev, isLoading: true }));

            const queueTracks = queuedTracks.map((qt) => qt.track);
            const seedQueueTracks = queuedTracks
              .filter((qt) => qt.queueSource !== "smart")
              .map((qt) => qt.track);
            const recommendedTracks = await onAutoQueueTrigger(
              currentTrack,
              queuedTracks.length,
              {
                history,
                queue: queueTracks,
                seedQueue: seedQueueTracks,
                source: "auto",
              },
            );

            if (recommendedTracks.length > 0) {
              const count = smartQueueSettings.autoQueueCount ?? 5;
              const tracksToAdd = recommendedTracks.slice(0, count);
              const smartQueuedTracks = tracksToAdd.map((t) =>
                createQueuedTrack(t, "smart"),
              );

              // Add smart tracks to the end of the queue
              setQueuedTracks((prev) => [...prev, ...smartQueuedTracks]);
              setSmartQueueState({
                isActive: true,
                lastRefreshedAt: new Date(),
                seedTrackId: currentTrack.id,
                trackCount: smartQueuedTracks.length,
                isLoading: false,
              });

              logger.debug(
                `[useAudioPlayer] ✅ Generated ${smartQueuedTracks.length} smart tracks, queue now has ${queuedTracks.length + smartQueuedTracks.length} tracks`,
              );
            } else {
              logger.warn("[useAudioPlayer] ⚠️ No smart tracks generated");
              setSmartQueueState((prev) => ({ ...prev, isLoading: false }));
            }
          } catch (error) {
            logger.error(
              "[useAudioPlayer] ❌ Failed to generate smart tracks:",
              error,
            );
            setSmartQueueState((prev) => ({ ...prev, isLoading: false }));
          }
        })();
      }
    }
  }, [
    queuedTracks,
    currentTrack,
    isPlaying,
    smartQueueState,
    history,
    createQueuedTrack,
  ]);

  useEffect(() => {
    if (
      !currentTrack ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    )
      return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist.name,
      album: currentTrack.album.title,
      artwork: [
        currentTrack.album.cover_small
          ? {
              src: currentTrack.album.cover_small,
              sizes: "56x56",
              type: "image/jpeg",
            }
          : undefined,
        currentTrack.album.cover_medium
          ? {
              src: currentTrack.album.cover_medium,
              sizes: "250x250",
              type: "image/jpeg",
            }
          : undefined,
        currentTrack.album.cover_big
          ? {
              src: currentTrack.album.cover_big,
              sizes: "500x500",
              type: "image/jpeg",
            }
          : undefined,
        currentTrack.album.cover_xl
          ? {
              src: currentTrack.album.cover_xl,
              sizes: "1000x1000",
              type: "image/jpeg",
            }
          : undefined,
      ].filter(
        (artwork): artwork is NonNullable<typeof artwork> =>
          artwork !== undefined,
      ),
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const enforcePlaybackRate = () => {
      if (!audioRef.current) return;
      const currentAudio = audioRef.current;
      if (
        currentAudio.playbackRate !== 1 ||
        currentAudio.defaultPlaybackRate !== 1
      ) {
        logger.warn(
          "[useAudioPlayer] ⚠️ Playback rate drift detected, resetting to 1.0",
          {
            playbackRate: currentAudio.playbackRate,
            defaultPlaybackRate: currentAudio.defaultPlaybackRate,
          },
        );
        currentAudio.playbackRate = 1;
        currentAudio.defaultPlaybackRate = 1;
      }

      const preserve = currentAudio as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      if (preserve.preservesPitch === false) {
        preserve.preservesPitch = true;
      }
      if (preserve.webkitPreservesPitch === false) {
        preserve.webkitPreservesPitch = true;
      }
    };

    const handleTimeUpdate = () => {
      const newTime = audio.currentTime;
      const timeBucket = Math.floor(newTime);

      if (timeBucket % 5 === 0 && timeBucket !== lastDebugTimeBucketRef.current) {
        lastDebugTimeBucketRef.current = timeBucket;
        logger.debug("[useAudioPlayer] Time update:", {
          currentTime: newTime,
          paused: audio.paused,
          readyState: audio.readyState,
          src: audio.src.substring(0, 50) + "...",
        });
      }
      setCurrentTime(newTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      enforcePlaybackRate();
    };
    const handlePlay = () => {
      enforcePlaybackRate();
      if (!isPlayPauseOperationRef.current && !isPlayingRef.current) {
        setIsPlaying(true);
      }
    };
    const handlePause = () => {
      if (!isPlayPauseOperationRef.current && isPlayingRef.current) {
        setIsPlaying(false);
      }
    };
    const handleEnded = () => {
      void handleTrackEnd();
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      if (streamErrorTrackIdRef.current === currentTrack?.id) {
        streamErrorRetryCountRef.current = 0;
      }
    };
    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const error = target.error;

      if (error?.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }

      const errorMessage = error?.message ?? "";

      const isAborted =
        errorMessage.includes("aborted") ||
        errorMessage.includes("AbortError") ||
        (errorMessage.includes("fetching process") &&
          errorMessage.includes("aborted"));

      if (isAborted) {
        logger.debug(
          "[useAudioPlayer] Fetch aborted (normal during rapid track changes)",
        );
        return;
      }

      const statusMatch = /\b(\d{3})\b/.exec(errorMessage);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      const isRetryableStatus =
        statusCode !== null && [429, 500, 502, 503, 504].includes(statusCode);
      const isRetryableMessage =
        /Bad Gateway|Gateway Timeout|Service Unavailable/i.test(errorMessage);
      const isNetworkError = error?.code === MediaError.MEDIA_ERR_NETWORK;

      const isHttpError =
        /^\d{3}:/.test(errorMessage) ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("503");
      const isUpstreamError =
        errorMessage.includes("upstream error") ||
        errorMessage.includes("ServiceUnavailableException");

      if (
        currentTrack &&
        (isUpstreamError ||
          isRetryableStatus ||
          isRetryableMessage ||
          isNetworkError)
      ) {
        if (streamErrorTrackIdRef.current !== currentTrack.id) {
          streamErrorRetryCountRef.current = 0;
          streamErrorTrackIdRef.current = currentTrack.id;
        }

        if (streamErrorRetryCountRef.current < maxStreamErrorRetries) {
          const attempt = streamErrorRetryCountRef.current;
          const baseDelayMs = 800;
          const jitterMs = Math.floor(Math.random() * 200);
          const delay =
            Math.min(5000, baseDelayMs * Math.pow(2, attempt)) + jitterMs;
          streamErrorRetryCountRef.current += 1;

          if (streamErrorRetryTimeoutRef.current) {
            clearTimeout(streamErrorRetryTimeoutRef.current);
          }

          logger.warn(
            `[useAudioPlayer] Transient stream error for track ${currentTrack.id}, retrying in ${delay}ms (attempt ${streamErrorRetryCountRef.current}/${maxStreamErrorRetries})`,
          );
          setIsLoading(true);
          setIsPlaying(false);

          streamErrorRetryTimeoutRef.current = setTimeout(() => {
            streamErrorRetryTimeoutRef.current = null;
            if (!audioRef.current) return;
            if (streamErrorTrackIdRef.current !== currentTrack.id) return;

            const retryUrl = `${getStreamUrlById(
              currentTrack.id.toString(),
            )}&retry=${Date.now()}`;
            loadTrackRef.current?.(currentTrack, retryUrl);
            playRef
              .current?.()
              .catch((err) =>
                logger.debug("[useAudioPlayer] Retry play() failed:", err),
              );
          }, delay);
          return;
        }

        streamErrorRetryCountRef.current = 0;
        if (streamErrorRetryTimeoutRef.current) {
          clearTimeout(streamErrorRetryTimeoutRef.current);
          streamErrorRetryTimeoutRef.current = null;
        }
        logger.error(
          `Audio error for track ${currentTrack.id}:`,
          errorMessage || "Stream failed",
        );
        failedTracksRef.current.add(currentTrack.id);
        setFailedTrackIds((prev) => new Set(prev).add(currentTrack.id));
        setIsLoading(false);
        setIsPlaying(false);

        onError?.(errorMessage || "Stream failed", currentTrack.id);

        setHistory((prev) => [...prev, currentTrack]);
        setQueuedTracks((prev) => prev.slice(1));
        if (queueRef.current.length > 1) {
          requestAutoPlayNext(true);
        }
        return;
      }

      if (isHttpError && currentTrack) {
        if (isUpstreamError) {
          logger.warn(
            `[useAudioPlayer] Upstream error for track ${currentTrack.id} - may be temporary:`,
            errorMessage,
          );
          failedTracksRef.current.add(currentTrack.id);
          setFailedTrackIds((prev) => new Set(prev).add(currentTrack.id));
          setIsLoading(false);
          setIsPlaying(false);
          onError?.(errorMessage, currentTrack.id);
          setHistory((prev) => [...prev, currentTrack]);
          setQueuedTracks((prev) => prev.slice(1));
          if (queueRef.current.length > 1) {
            requestAutoPlayNext(true);
          }
          retryCountRef.current = 0;
          return;
        }

        failedTracksRef.current.add(currentTrack.id);
        setFailedTrackIds((prev) => new Set(prev).add(currentTrack.id));
        logger.error(`Audio error for track ${currentTrack.id}:`, errorMessage);
        setIsLoading(false);
        setIsPlaying(false);

        onError?.(errorMessage, currentTrack.id);

        setHistory((prev) => [...prev, currentTrack]);
        setQueuedTracks((prev) => prev.slice(1));
        if (queueRef.current.length > 1) {
          requestAutoPlayNext(true);
        }
        retryCountRef.current = 0;
        return;
      }

      logger.error("Audio error:", errorMessage || "Unknown error");
      setIsLoading(false);
      setIsPlaying(false);
    };

    const handleRateChange = () => {
      if (audioRef.current) {
        logger.warn("[useAudioPlayer] ⚠️ Playback rate change detected", {
          playbackRate: audioRef.current.playbackRate,
          defaultPlaybackRate: audioRef.current.defaultPlaybackRate,
        });
      }
      enforcePlaybackRate();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ratechange", handleRateChange);

    const playbackRateInterval = setInterval(() => {
      enforcePlaybackRate();
    }, 1000);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ratechange", handleRateChange);
      clearInterval(playbackRateInterval);
    };
  }, [handleTrackEnd, currentTrack, onError, requestAutoPlayNext]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined")
      return;

    if (!keepPlaybackAlive) {
      shouldResumeOnFocusRef.current = false;
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const markShouldResume = () => {
      shouldResumeOnFocusRef.current =
        isPlayingRef.current || (!audio.paused && !audio.ended);
    };

    const enforcePlaybackRate = () => {
      if (!audioRef.current) return;
      const currentAudio = audioRef.current;
      if (
        currentAudio.playbackRate !== 1 ||
        currentAudio.defaultPlaybackRate !== 1
      ) {
        logger.warn(
          "[useAudioPlayer] ⚠️ Playback rate drift detected, resetting to 1.0",
          {
            playbackRate: currentAudio.playbackRate,
            defaultPlaybackRate: currentAudio.defaultPlaybackRate,
          },
        );
        currentAudio.playbackRate = 1;
        currentAudio.defaultPlaybackRate = 1;
      }

      const preserve = currentAudio as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      if (preserve.preservesPitch === false) {
        preserve.preservesPitch = true;
      }
      if (preserve.webkitPreservesPitch === false) {
        preserve.webkitPreservesPitch = true;
      }
    };

    const resumePlayback = async (reason: string) => {
      if (!audio.src) return;
      try {
        const connection = getAudioConnection(audio);
        if (connection?.audioContext.state === "suspended") {
          await connection.audioContext.resume();
        }
      } catch (err) {
        logger.debug(
          `[useAudioPlayer] Failed to resume audio context (${reason}):`,
          err,
        );
        onBackgroundResumeError?.(reason, err);
      }

      enforcePlaybackRate();

      if (audio.paused) {
        audio
          .play()
          .then(() => {
            shouldResumeOnFocusRef.current = false;
          })
          .catch((err) => {
            logger.debug(
              `[useAudioPlayer] Could not resume playback (${reason}):`,
              err,
            );
            onBackgroundResumeError?.(reason, err);
          });
      } else {
        shouldResumeOnFocusRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug(
          "[useAudioPlayer] 🌙 Page hidden - maintaining playback state",
        );
        markShouldResume();
      } else {
        logger.debug(
          "[useAudioPlayer] 🌞 Page visible - checking playback state",
        );

        if (shouldResumeOnFocusRef.current && audio.paused) {
          logger.warn(
            "[useAudioPlayer] ⚠️ Audio was paused while in background, resuming...",
          );
          void resumePlayback("visibility");
        }
      }
    };

    const handleAudioInterruption = () => {
      logger.debug("[useAudioPlayer] 🎧 Audio session interrupted");
      markShouldResume();
    };

    const handleAudioInterruptionEnd = () => {
      logger.debug(
        "[useAudioPlayer] ✅ Audio session interruption ended, checking playback",
      );

      if (shouldResumeOnFocusRef.current && audio.paused) {
        setTimeout(() => {
          void resumePlayback("interruption");
        }, 100);
      }
    };

    const handlePageHide = () => {
      logger.debug("[useAudioPlayer] 📭 Page hidden (pagehide)");
      markShouldResume();
    };

    const handlePageShow = () => {
      logger.debug("[useAudioPlayer] 📬 Page shown (pageshow)");
      if (shouldResumeOnFocusRef.current && audio.paused) {
        void resumePlayback("pageshow");
      }
    };

    const handleFreeze = () => {
      logger.debug("[useAudioPlayer] 🧊 Page frozen");
      markShouldResume();
    };

    const handleResume = () => {
      logger.debug("[useAudioPlayer] 🔥 Page resumed");
      if (shouldResumeOnFocusRef.current && audio.paused) {
        void resumePlayback("resume");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("freeze", handleFreeze);
    document.addEventListener("resume", handleResume);

    if ("onwebkitbegininvokeactivity" in window) {
      window.addEventListener("pagehide", handleAudioInterruption);
      window.addEventListener("pageshow", handleAudioInterruptionEnd);
    } else {
      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("pageshow", handlePageShow);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("freeze", handleFreeze);
      document.removeEventListener("resume", handleResume);
      if ("onwebkitbegininvokeactivity" in window) {
        window.removeEventListener("pagehide", handleAudioInterruption);
        window.removeEventListener("pageshow", handleAudioInterruptionEnd);
      } else {
        window.removeEventListener("pagehide", handlePageHide);
        window.removeEventListener("pageshow", handlePageShow);
      }
    };
  }, [keepPlaybackAlive, onBackgroundResumeError]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined")
      return;
    if (!("serviceWorker" in navigator)) return;

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (isPlaying && currentTrack) {
      keepAliveIntervalRef.current = setInterval(() => {
        navigator.serviceWorker.ready
          .then((registration) => {
            if (registration.active) {
              registration.active.postMessage({ type: "KEEP_ALIVE" });
            }
          })
          .catch((err) => {
            logger.warn(
              "[useAudioPlayer] Service worker keep-alive failed:",
              err,
            );
          });
      }, KEEP_ALIVE_INTERVAL_MS);

      logger.debug(
        "[useAudioPlayer] 💓 Started service worker keep-alive pings",
      );
    }

    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
        logger.debug(
          "[useAudioPlayer] 🛑 Stopped service worker keep-alive pings",
        );
      }
    };
  }, [isPlaying, currentTrack]);

  const loadTrack = useCallback(
    (track: Track, streamUrl: string) => {
      if (!audioRef.current) return;

      if (failedTracksRef.current.has(track.id)) {
        logger.warn(
          `[useAudioPlayer] Track ${track.id} previously failed, skipping load`,
        );
        setIsLoading(false);
        setIsPlaying(false);
        return;
      }

      const currentLoadId = ++loadIdRef.current;

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (streamErrorRetryTimeoutRef.current) {
        clearTimeout(streamErrorRetryTimeoutRef.current);
        streamErrorRetryTimeoutRef.current = null;
      }

      if (currentTrack?.id !== track.id) {
        retryCountRef.current = 0;
        streamErrorRetryCountRef.current = 0;
        streamErrorTrackIdRef.current = track.id;
      }

      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (error) {
        logger.debug("[useAudioPlayer] Error resetting audio:", error);
      }

      const applySource = () => {
        if (currentLoadId !== loadIdRef.current) {
          logger.debug(
            "[useAudioPlayer] Load cancelled, newer load in progress",
          );
          return false;
        }

        if (!audioRef.current) return false;

        try {
          logger.debug("[useAudioPlayer] Setting audio source:", {
            streamUrl,
            currentSrc: audioRef.current.src,
            readyState: audioRef.current.readyState,
          });
          audioRef.current.src = streamUrl;
          audioRef.current.playbackRate = 1;
          audioRef.current.defaultPlaybackRate = 1;
          const preserve = audioRef.current as HTMLAudioElement & {
            preservesPitch?: boolean;
            webkitPreservesPitch?: boolean;
          };
          preserve.preservesPitch = true;
          preserve.webkitPreservesPitch = true;
          audioRef.current.load();

          logger.debug("[useAudioPlayer] Audio source set and load() called");
          return true;
        } catch (error) {
          if (
            error instanceof DOMException &&
            (error.name === "AbortError" ||
              error.message?.includes("aborted") ||
              error.message?.includes("fetching process"))
          ) {
            logger.debug(
              "[useAudioPlayer] Loading aborted for new source (ignored).",
            );
            return false;
          } else {
            logger.error(
              "[useAudioPlayer] Failed to load new audio source:",
              error,
            );
            return false;
          }
        }
      };

      const applied = applySource();
      if (!applied) {
        if (retryCountRef.current < maxRetries) {
          const delay =
            AUDIO_CONSTANTS.AUDIO_LOAD_RETRY_DELAY_MS *
            Math.pow(2, retryCountRef.current);
          retryCountRef.current++;

          retryTimeoutRef.current = setTimeout(() => {
            if (currentLoadId === loadIdRef.current && audioRef.current) {
              applySource();
            }
          }, delay);
        } else {
          logger.error(
            `[useAudioPlayer] Max retries (${maxRetries}) exceeded for track ${track.id}`,
          );
          failedTracksRef.current.add(track.id);
          setFailedTrackIds((prev) => new Set(prev).add(track.id));
          retryCountRef.current = 0;
          setIsLoading(false);
          setIsPlaying(false);
          onError?.(
            `Failed to load track after ${maxRetries} retries`,
            track.id,
          );
        }
      } else {
        retryCountRef.current = 0;
      }

      onTrackChange?.(track);
    },
    [currentTrack, onTrackChange, onError],
  );

  loadTrackRef.current = loadTrack;

  const play = useCallback(async () => {
    if (!audioRef.current) {
      logger.warn(
        "[useAudioPlayer] play() called but audioRef.current is null",
      );
      setIsPlaying(false);
      return;
    }

    if (isPlayPauseOperationRef.current) {
      logger.debug(
        "[useAudioPlayer] Play operation already in progress, skipping",
      );
      return;
    }

    isPlayPauseOperationRef.current = true;

    try {
      logger.debug("[useAudioPlayer] Attempting to play audio", {
        src: audioRef.current.src,
        readyState: audioRef.current.readyState,
        paused: audioRef.current.paused,
        currentTime: audioRef.current.currentTime,
      });

      audioRef.current.playbackRate = 1;
      audioRef.current.defaultPlaybackRate = 1;
      const preserve = audioRef.current as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      preserve.preservesPitch = true;
      preserve.webkitPreservesPitch = true;

      const connection = getAudioConnection(audioRef.current);
      if (connection) {
        logger.debug("[useAudioPlayer] Audio connected to Web Audio API", {
          contextState: connection.audioContext.state,
          hasAnalyser: !!connection.analyser,
          hasFilters: !!connection.filters,
        });

        ensureConnectionChain(connection);

        if (connection.audioContext.state === "suspended") {
          logger.debug("[useAudioPlayer] Resuming suspended audio context");
          await connection.audioContext.resume();
        }
      } else {
        logger.debug(
          "[useAudioPlayer] Audio not connected to Web Audio API (normal playback)",
        );
      }

      if (!audioRef.current.src) {
        logger.warn("[useAudioPlayer] No audio source set, cannot play");
        setIsPlaying(false);
        return;
      }

      if (audioRef.current.readyState < 2) {
        logger.debug(
          "[useAudioPlayer] Audio not ready, waiting for canplay event",
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Audio load timeout"));
          }, 10000);

          const handleCanPlay = () => {
            clearTimeout(timeout);
            audioRef.current?.removeEventListener("canplay", handleCanPlay);
            audioRef.current?.removeEventListener("error", handleError);
            resolve();
          };

          const handleError = () => {
            clearTimeout(timeout);
            audioRef.current?.removeEventListener("canplay", handleCanPlay);
            audioRef.current?.removeEventListener("error", handleError);
            reject(new Error("Audio load error"));
          };

          audioRef.current?.addEventListener("canplay", handleCanPlay, {
            once: true,
          });
          audioRef.current?.addEventListener("error", handleError, {
            once: true,
          });
        });
      }

      const playPromise = audioRef.current.play();
      logger.debug("[useAudioPlayer] play() called, waiting for promise...");

      await playPromise;
      logger.debug("[useAudioPlayer] Playback started successfully", {
        paused: audioRef.current.paused,
        currentTime: audioRef.current.currentTime,
        readyState: audioRef.current.readyState,
      });

      if (connection) {
        logger.debug(
          "[useAudioPlayer] Verifying connection chain after play...",
        );
        const isValid = verifyConnectionChain(connection);
        if (!isValid) {
          logger.warn(
            "[useAudioPlayer] Connection chain invalid, rebuilding...",
          );
          ensureConnectionChain(connection);
        } else {
          logger.debug("[useAudioPlayer] Connection chain verified");
        }
      }

      if (audioRef.current) {
        audioRef.current.playbackRate = 1;
        audioRef.current.defaultPlaybackRate = 1;
      }

      setIsPlaying(true);
    } catch (err) {
      logger.error("[useAudioPlayer] Playback failed:", err);
      logger.error("[useAudioPlayer] Error details:", {
        name: err instanceof Error ? err.name : "Unknown",
        message: err instanceof Error ? err.message : String(err),
        audioState: audioRef.current
          ? {
              src: audioRef.current.src,
              paused: audioRef.current.paused,
              readyState: audioRef.current.readyState,
              currentTime: audioRef.current.currentTime,
            }
          : "no audio element",
      });
      setIsPlaying(false);
    } finally {
      isPlayPauseOperationRef.current = false;
    }
  }, []);

  playRef.current = play;

  const pause = useCallback(() => {
    if (!audioRef.current) {
      logger.warn(
        "[useAudioPlayer] Cannot pause: audio element not initialized",
      );
      setIsPlaying(false);
      return;
    }

    if (isPlayPauseOperationRef.current) {
      logger.debug(
        "[useAudioPlayer] Pause operation already in progress, skipping",
      );
      return;
    }

    isPlayPauseOperationRef.current = true;

    try {
      audioRef.current.pause();

      setIsPlaying(false);
    } catch (error) {
      logger.error("[useAudioPlayer] Error pausing audio:", error);
      setIsPlaying(false);
    } finally {
      isPlayPauseOperationRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;

    const togglePlayPause = () => {
      if (audioRef.current && !isPlayPauseOperationRef.current) {
        const isActuallyPlaying = !audioRef.current.paused;
        if (isActuallyPlaying) {
          pause();
        } else {
          play().catch((error) => {
            logger.error("Playback failed:", error);
          });
        }
      }
    };

    const handleNextTrack = () => {
      if (queue.length > 1) {
        requestAutoPlayNext(true);
        setHistory((prev) => [...prev, currentTrack!]);
        setQueuedTracks((prev) => prev.slice(1));
      }
    };

    const handlePreviousTrack = () => {
      if (
        audioRef.current &&
        audioRef.current.currentTime > PREVIOUS_TRACK_RESTART_THRESHOLD_SEC
      ) {
        audioRef.current.currentTime = 0;
      } else if (history.length > 0) {
        const prevTrack = history[history.length - 1];
        if (prevTrack && currentTrack) {
          requestAutoPlayNext(true);
          setQueuedTracks((prev) => [
            createQueuedTrack(prevTrack, "user"),
            ...prev,
          ]);
        }
        setHistory((prev) => prev.slice(0, -1));
      }
    };

    const handleSeekBackward = (details: MediaSessionActionDetails) => {
      if (audioRef.current) {
        const seekTime = details.seekOffset ?? 10;
        audioRef.current.currentTime = Math.max(
          0,
          audioRef.current.currentTime - seekTime,
        );
      }
    };

    const handleSeekForward = (details: MediaSessionActionDetails) => {
      if (audioRef.current) {
        const seekTime = details.seekOffset ?? 10;
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration,
          audioRef.current.currentTime + seekTime,
        );
      }
    };

    const handleSeekTo = (details: MediaSessionActionDetails) => {
      if (audioRef.current && details.seekTime !== undefined) {
        audioRef.current.currentTime = details.seekTime;
      }
    };

    try {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("nexttrack", handleNextTrack);
      navigator.mediaSession.setActionHandler(
        "previoustrack",
        handlePreviousTrack,
      );
      navigator.mediaSession.setActionHandler(
        "seekbackward",
        handleSeekBackward,
      );
      navigator.mediaSession.setActionHandler("seekforward", handleSeekForward);
      navigator.mediaSession.setActionHandler("seekto", handleSeekTo);
    } catch (error) {
      logger.error("Failed to set media session handlers:", error);
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      } catch {}
    };
  }, [
    currentTrack,
    queue,
    history,
    isPlaying,
    play,
    pause,
    createQueuedTrack,
    requestAutoPlayNext,
  ]);

  const togglePlay = useCallback(async () => {
    const isActuallyPlaying = audioRef.current && !audioRef.current.paused;

    logger.debug("[useAudioPlayer] togglePlay called", {
      reactState_isPlaying: isPlaying,
      audioElement_paused: audioRef.current?.paused,
      isActuallyPlaying,
      willCall: isActuallyPlaying ? "pause()" : "play()",
    });

    if (isActuallyPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;

    if (!isFinite(time)) {
      logger.error(`[useAudioPlayer] ❌ Invalid seek time: ${time}`);
      return;
    }

    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const playPrevious = useCallback(() => {
    if (history.length === 0) return null;

    requestAutoPlayNext(true);
    const previousTracks = [...history];
    const prevTrack = previousTracks.pop()!;
    setHistory(previousTracks);

    setQueuedTracks((prev) => [createQueuedTrack(prevTrack, "user"), ...prev]);

    return prevTrack;
  }, [history, createQueuedTrack, requestAutoPlayNext]);

  const isValidTrack = useCallback(
    (track: Track | null | undefined): track is Track => {
      if (!track) return false;

      return (
        typeof track.id === "number" &&
        track.id > 0 &&
        typeof track.title === "string" &&
        track.title.length > 0 &&
        typeof track.duration === "number" &&
        track.duration > 0 &&
        track.artist?.id != null &&
        typeof track.artist?.name === "string" &&
        track.artist.name.length > 0 &&
        track.album?.id != null &&
        typeof track.album?.title === "string" &&
        track.album.title.length > 0
      );
    },
    [],
  );

  const addToQueue = useCallback(
    (track: Track | Track[], checkDuplicates = true) => {
      const tracks = Array.isArray(track) ? track : [track];

      logger.debug("[useAudioPlayer] 📥 addToQueue called:", {
        trackCount: tracks.length,
        checkDuplicates,
        currentQueueSize: queuedTracks.length,
        tracks: tracks.map((t) => `${t.title} - ${t.artist.name}`),
      });

      const validTracks = tracks.filter((t): t is Track => {
        const valid = isValidTrack(t);
        if (!valid) {
          logger.warn(
            `[useAudioPlayer] ⚠️ Rejecting invalid track:`,
            t && typeof t === "object" && "title" in t
              ? (t as Track).title
              : "any",
          );
        }
        return valid;
      });

      if (validTracks.length === 0) {
        logger.warn("[useAudioPlayer] ❌ No valid tracks to add to queue");
        return;
      }

      if (checkDuplicates) {
        const duplicates = validTracks.filter((t) =>
          queuedTracks.some((qt) => qt.track.id === t.id),
        );

        if (duplicates.length > 0 && onDuplicateTrack) {
          duplicates.forEach((dup) => onDuplicateTrack?.(dup));
        }

        const uniqueTracks = validTracks.filter(
          (t) => !queuedTracks.some((qt) => qt.track.id === t.id),
        );

        logger.debug(
          "[useAudioPlayer] 🔍 After validation & duplicate check:",
          {
            original: tracks.length,
            valid: validTracks.length,
            duplicates: duplicates.length,
            uniqueTracks: uniqueTracks.length,
          },
        );

        if (uniqueTracks.length > 0) {
          const newQueuedTracks = uniqueTracks.map((t) =>
            createQueuedTrack(t, "user"),
          );
          setQueuedTracks((prev) => {
            logger.debug("[useAudioPlayer] ✅ Adding tracks to queue:", {
              previousSize: prev.length,
              adding: newQueuedTracks.length,
              newSize: prev.length + newQueuedTracks.length,
            });

            return [...prev, ...newQueuedTracks];
          });
        } else {
          logger.debug(
            "[useAudioPlayer] ⚠️ No unique valid tracks to add (filtered out)",
          );
        }
      } else {
        logger.debug(
          "[useAudioPlayer] ➕ Adding valid tracks without duplicate check",
        );
        const newQueuedTracks = validTracks.map((t) =>
          createQueuedTrack(t, "user"),
        );
        setQueuedTracks((prev) => {
          logger.debug("[useAudioPlayer] ✅ Queue updated:", {
            previousSize: prev.length,
            adding: newQueuedTracks.length,
            newSize: prev.length + newQueuedTracks.length,
          });
          return [...prev, ...newQueuedTracks];
        });
      }
    },
    [queuedTracks, createQueuedTrack, onDuplicateTrack, isValidTrack],
  );

  const addToPlayNext = useCallback(
    (track: Track | Track[]) => {
      const tracks = Array.isArray(track) ? track : [track];

      const validTracks = tracks.filter((t): t is Track => {
        const valid = isValidTrack(t);
        if (!valid) {
          logger.warn(
            `[useAudioPlayer] ⚠️ Rejecting invalid track in addToPlayNext:`,
            t && typeof t === "object" && "title" in t
              ? (t as Track).title
              : "Unknown",
          );
        }
        return valid;
      });

      if (validTracks.length === 0) {
        logger.warn("[useAudioPlayer] ❌ No valid tracks to add to play next");
        return;
      }

      const newQueuedTracks = validTracks.map((t) =>
        createQueuedTrack(t, "user"),
      );
      setQueuedTracks((prev) => {
        if (prev.length === 0) {
          return newQueuedTracks;
        }
        const [current, ...rest] = prev;
        return [current!, ...newQueuedTracks, ...rest];
      });
    },
    [createQueuedTrack, isValidTrack],
  );

  const removeFromQueue = useCallback((index: number) => {
    logger.debug("[useAudioPlayer] removeFromQueue called", {
      index,
      isCurrentTrack: index === 0,
    });

    if (index === 0) {
      logger.warn(
        "[useAudioPlayer] Cannot remove currently playing track (queuedTracks[0])",
      );
      return;
    }

    setQueuedTracks((prev) => {
      const newQueue = prev.filter((_, i) => i !== index);
      logger.debug("[useAudioPlayer] Queue updated after removal", {
        previousLength: prev.length,
        newLength: newQueue.length,
        removedIndex: index,
      });
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    const newQueue = queuedTracks.length > 0 ? [queuedTracks[0]!] : [];
    setQueuedTracks(newQueue);

    if (newQueue.length === 0) {
      clearPersistedQueueState();
    }
  }, [queuedTracks]);

  const reorderQueue = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === 0 || newIndex === 0) {
      logger.warn(
        "[useAudioPlayer] Cannot reorder currently playing track (queuedTracks[0])",
      );
      return;
    }

    setQueuedTracks((prev) => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(oldIndex, 1);

      if (removed) {
        newQueue.splice(newIndex, 0, removed);
      }

      return newQueue;
    });
  }, []);

  const playFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return null;

      const selectedTrack = queue[index];
      if (!selectedTrack) return null;

      if (index !== 0) {
        requestAutoPlayNext(true);
      }

      const tracksToHistory = queue.slice(0, index);
      const tracksAfter = queue.slice(index + 1);

      setHistory((prev) => [...prev, ...tracksToHistory]);
      setQueuedTracks([
        createQueuedTrack(selectedTrack, "user"),
        ...tracksAfter.map((t) => createQueuedTrack(t, "user")),
      ]);

      return selectedTrack;
    },
    [queue, createQueuedTrack, requestAutoPlayNext],
  );

  const shuffleUpcomingTracks = useCallback(
    (upcomingTracks: QueuedTrack[], currentArtistId: number | null) => {
      if (upcomingTracks.length <= 1) return upcomingTracks;

      const pool = [...upcomingTracks];

      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }

      const shuffled: QueuedTrack[] = [];
      let lastArtistId = currentArtistId;

      while (pool.length > 0) {
        const nextIndex = pool.findIndex(
          (qt) => lastArtistId === null || qt.track.artist.id !== lastArtistId,
        );
        const selectedIndex = nextIndex === -1 ? 0 : nextIndex;
        const [selected] = pool.splice(selectedIndex, 1);

        if (!selected) continue;

        shuffled.push(selected);
        lastArtistId = selected.track.artist.id;
      }

      return shuffled;
    },
    [],
  );

  const restoreUpcomingOrder = useCallback(
    (upcomingTracks: QueuedTrack[], originalUpcomingOrder: QueuedTrack[]) => {
      if (originalUpcomingOrder.length === 0 || upcomingTracks.length <= 1) {
        return upcomingTracks;
      }

      const availableByTrackId = new Map<number, QueuedTrack[]>();
      for (const queuedTrack of upcomingTracks) {
        const existing = availableByTrackId.get(queuedTrack.track.id);
        if (existing) {
          existing.push(queuedTrack);
        } else {
          availableByTrackId.set(queuedTrack.track.id, [queuedTrack]);
        }
      }

      const restored: QueuedTrack[] = [];
      for (const originalTrack of originalUpcomingOrder) {
        const matches = availableByTrackId.get(originalTrack.track.id);
        const nextMatch = matches?.shift();
        if (nextMatch) {
          restored.push(nextMatch);
        }
      }

      const restoredQueueIds = new Set(restored.map((qt) => qt.queueId));
      const extras = upcomingTracks.filter(
        (qt) => !restoredQueueIds.has(qt.queueId),
      );

      return [...restored, ...extras];
    },
    [],
  );

  const toggleShuffle = useCallback(() => {
    setIsShuffled((previousIsShuffled) => {
      const nextIsShuffled = !previousIsShuffled;

      setQueuedTracks((previousQueue) => {
        if (previousQueue.length <= 1) {
          originalQueueOrderRef.current = [];
          return previousQueue;
        }

        const [currentQueuedTrack, ...upcomingTracks] = previousQueue;
        if (!currentQueuedTrack) return previousQueue;

        if (nextIsShuffled) {
          originalQueueOrderRef.current = [...upcomingTracks];
          const shuffledUpcoming = shuffleUpcomingTracks(
            upcomingTracks,
            currentQueuedTrack.track.artist.id,
          );
          return [currentQueuedTrack, ...shuffledUpcoming];
        }

        const originalUpcomingOrder = originalQueueOrderRef.current;
        originalQueueOrderRef.current = [];

        if (originalUpcomingOrder.length === 0) {
          return previousQueue;
        }

        const restoredUpcoming = restoreUpcomingOrder(
          upcomingTracks,
          originalUpcomingOrder,
        );

        return [currentQueuedTrack, ...restoredUpcoming];
      });

      return nextIsShuffled;
    });
  }, [restoreUpcomingOrder, shuffleUpcomingTracks]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "none") return "all";
      if (prev === "all") return "one";
      return "none";
    });
  }, []);

  const addSmartTracks = useCallback(
    async (
      countOrOptions?:
        | number
        | { count: number; similarityLevel: "strict" | "balanced" | "diverse" },
    ): Promise<Track[]> => {
      const currentQueuedTrack = queuedTracks[0];
      if (!currentQueuedTrack) {
        logger.warn(
          "[useAudioPlayer] ⚠️ Cannot add smart tracks: no current track",
        );
        return [];
      }

      const seedTrack = currentQueuedTrack.track;

      const count =
        typeof countOrOptions === "number"
          ? countOrOptions
          : (countOrOptions?.count ?? 5);
      const similarityLevel =
        typeof countOrOptions === "object" && countOrOptions?.similarityLevel
          ? countOrOptions.similarityLevel
          : undefined;

      logger.debug(
        "[useAudioPlayer] 🎵 Adding smart tracks based on:",
        seedTrack.title,
        { count, similarityLevel },
      );

      setSmartQueueState((prev) => ({ ...prev, isLoading: true }));

      try {
        let recommendedTracks: Track[] = [];

        if (similarityLevel && optionsRef.current.onCustomSmartTracksFetch) {
          const queueTracks = queuedTracks.map((qt) => qt.track);
          const seedQueueTracks = queuedTracks
            .filter((qt) => qt.queueSource !== "smart")
            .map((qt) => qt.track);
          recommendedTracks = await optionsRef.current.onCustomSmartTracksFetch(
            seedTrack,
            {
              count,
              similarityLevel,
            },
            { history, queue: queueTracks, seedQueue: seedQueueTracks },
          );
        } else if (optionsRef.current.onAutoQueueTrigger) {
          const queueTracks = queuedTracks.map((qt) => qt.track);
          const seedQueueTracks = queuedTracks
            .filter((qt) => qt.queueSource !== "smart")
            .map((qt) => qt.track);
          const fetchedTracks = await optionsRef.current.onAutoQueueTrigger(
            seedTrack,
            queuedTracks.length,
            {
              history,
              queue: queueTracks,
              seedQueue: seedQueueTracks,
              source: "manual",
            },
          );
          recommendedTracks = fetchedTracks.slice(0, count);
        }

        if (recommendedTracks.length > 0) {
          const smartQueuedTracks = recommendedTracks.map((t) =>
            createQueuedTrack(t, "smart"),
          );
          setQueuedTracks((prev) => [...prev, ...smartQueuedTracks]);
          setSmartQueueState({
            isActive: true,
            lastRefreshedAt: new Date(),
            seedTrackId: seedTrack.id,
            trackCount: recommendedTracks.length,
            isLoading: false,
          });
          logger.debug(
            `[useAudioPlayer] ✅ Added ${recommendedTracks.length} smart tracks to queue`,
          );
          return recommendedTracks;
        }
        setSmartQueueState((prev) => ({ ...prev, isLoading: false }));
        return [];
      } catch (error) {
        logger.error("[useAudioPlayer] ❌ Failed to add smart tracks:", error);
        setSmartQueueState((prev) => ({ ...prev, isLoading: false }));
        return [];
      }
    },
    [queuedTracks, history, createQueuedTrack],
  );

  const refreshSmartTracks = useCallback(async (): Promise<void> => {
    logger.debug("[useAudioPlayer] 🔄 Refreshing smart tracks");

    const currentQueuedTrack = queuedTracks[0];
    if (!currentQueuedTrack) {
      logger.warn(
        "[useAudioPlayer] ⚠️ Cannot refresh smart tracks: no current track",
      );
      return;
    }

    const seedTrack = currentQueuedTrack.track;
    const baseQueue = queuedTracks.filter((qt) => qt.queueSource !== "smart");

    if (!optionsRef.current.onAutoQueueTrigger) {
      logger.warn(
        "[useAudioPlayer] ⚠️ Cannot refresh smart tracks: auto queue trigger missing",
      );
      return;
    }

    setSmartQueueState((prev) => ({ ...prev, isLoading: true }));

    try {
      const recommendedTracks = await optionsRef.current.onAutoQueueTrigger(
        seedTrack,
        baseQueue.length,
        {
          history,
          queue: queuedTracks.map((qt) => qt.track),
          seedQueue: baseQueue.map((qt) => qt.track),
          source: "manual",
        },
      );

      const shuffled = [...recommendedTracks];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }

      const tracksToAdd = shuffled.slice(0, 5);
      const smartQueuedTracks = tracksToAdd.map((t) =>
        createQueuedTrack(t, "smart"),
      );

      setQueuedTracks([...baseQueue, ...smartQueuedTracks]);
      setSmartQueueState({
        isActive: smartQueuedTracks.length > 0,
        lastRefreshedAt: new Date(),
        seedTrackId: seedTrack.id,
        trackCount: smartQueuedTracks.length,
        isLoading: false,
      });

      logger.debug(
        `[useAudioPlayer] ✅ Refreshed smart tracks (${smartQueuedTracks.length})`,
      );
    } catch (error) {
      logger.error(
        "[useAudioPlayer] ❌ Failed to refresh smart tracks:",
        error,
      );
      setSmartQueueState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [queuedTracks, history, createQueuedTrack]);

  const clearSmartTracks = useCallback(() => {
    logger.debug("[useAudioPlayer] 🧹 Clearing smart tracks");
    setQueuedTracks((prev) => prev.filter((qt) => qt.queueSource !== "smart"));
    setSmartQueueState({
      isActive: false,
      lastRefreshedAt: null,
      seedTrackId: null,
      trackCount: 0,
      isLoading: false,
    });
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    setVolume((prev) => Math.max(0, Math.min(1, prev + delta)));
  }, []);

  const skipForward = useCallback(
    (seconds = 10) => {
      if (!audioRef.current) return;

      const validSeconds = isFinite(seconds) ? seconds : 10;

      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration;

      if (!isFinite(currentTime) || !isFinite(duration)) {
        logger.warn(
          `[useAudioPlayer] ⚠️ Skip forward failed: audio not ready (currentTime: ${currentTime}, duration: ${duration})`,
        );
        return;
      }

      const newTime = Math.min(duration, currentTime + validSeconds);

      if (!isFinite(newTime)) {
        logger.error(
          `[useAudioPlayer] ❌ Skip forward calculated invalid time: ${newTime} (currentTime: ${currentTime}, duration: ${duration}, seconds: ${validSeconds})`,
        );
        return;
      }

      logger.debug(
        `[useAudioPlayer] ⏩ Skip forward ${validSeconds}s: ${currentTime.toFixed(1)}s → ${newTime.toFixed(1)}s`,
      );
      seek(newTime);
    },
    [seek],
  );

  const skipBackward = useCallback(
    (seconds = 10) => {
      if (!audioRef.current) return;

      const validSeconds = isFinite(seconds) ? seconds : 10;

      const currentTime = audioRef.current.currentTime;

      if (!isFinite(currentTime)) {
        logger.warn(
          `[useAudioPlayer] ⚠️ Skip backward failed: audio not ready (currentTime: ${currentTime})`,
        );
        return;
      }

      const newTime = Math.max(0, currentTime - validSeconds);

      if (!isFinite(newTime)) {
        logger.error(
          `[useAudioPlayer] ❌ Skip backward calculated invalid time: ${newTime} (currentTime: ${currentTime}, seconds: ${validSeconds})`,
        );
        return;
      }

      logger.debug(
        `[useAudioPlayer] ⏪ Skip backward ${validSeconds}s: ${currentTime.toFixed(1)}s → ${newTime.toFixed(1)}s`,
      );
      seek(newTime);
    },
    [seek],
  );

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const streamUrl = getStreamUrlById(currentTrack.id.toString());
    const currentSrc = audioRef.current.src;
    const isNewTrack = lastLoadedTrackIdRef.current !== currentTrack.id;
    const needsLoad = isNewTrack || !currentSrc || currentSrc !== streamUrl;

    if (!needsLoad) return;

    const isInitialMount = isInitialMountRef.current;
    const forceAutoPlay = shouldAutoPlayNextRef.current;
    if (isInitialMountRef.current) {
      if (!forceAutoPlay) {
        logger.debug(
          "[useAudioPlayer] 🚫 Skipping auto-play on initial mount (browser autoplay policy)",
        );
      }
      isInitialMountRef.current = false;
    }

    logger.debug(
      `[useAudioPlayer] 🎶 Loading new track: ${currentTrack.title}`,
      {
        streamUrl,
        currentSrc,
      },
    );
    loadTrack(currentTrack, streamUrl);
    lastLoadedTrackIdRef.current = currentTrack.id;

    const shouldAutoPlay = forceAutoPlay || isPlayingRef.current;
    const allowAutoPlay = shouldAutoPlay && (!isInitialMount || forceAutoPlay);

    shouldAutoPlayNextRef.current = false;

    if (allowAutoPlay) {
      setTimeout(() => {
        play().catch((error) => {
          if (
            error instanceof DOMException &&
            (error.name === "AbortError" ||
              error.message?.includes("aborted") ||
              error.message?.includes("fetching process"))
          ) {
            logger.debug(
              "[useAudioPlayer] Playback aborted (normal during rapid track changes)",
            );
            return;
          }
          logger.error("Playback failed:", error);
        });
      }, AUTO_PLAY_DELAY_MS);
    }
  }, [currentTrack, loadTrack, play]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (audioRef.current && !isPlayPauseOperationRef.current) {
        const actuallyPlaying = !audioRef.current.paused;

        if (actuallyPlaying !== isPlayingRef.current) {
          const now = Date.now();
          const lastSync = lastStateSyncRef.current;

          const shouldSync =
            !lastSync ||
            now - lastSync.time > STATE_SYNC_DEBOUNCE_MS ||
            lastSync.wasPlaying !== actuallyPlaying;

          if (shouldSync) {
            logger.debug(
              "[useAudioPlayer] 🔄 Syncing state: audio is",
              actuallyPlaying ? "playing" : "paused",
              "but state says",
              isPlayingRef.current,
            );
            setIsPlaying(actuallyPlaying);
            lastStateSyncRef.current = {
              time: now,
              wasPlaying: actuallyPlaying,
            };
          }
        }
      }
    }, STATE_SYNC_INTERVAL_MS);

    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (streamErrorRetryTimeoutRef.current) {
        clearTimeout(streamErrorRetryTimeoutRef.current);
      }
    };
  }, []);

  const clearFailedTrack = useCallback((trackId: number) => {
    failedTracksRef.current.delete(trackId);
    setFailedTrackIds((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }, []);

  const clearAllFailedTracks = useCallback(() => {
    failedTracksRef.current.clear();
    setFailedTrackIds(new Set());
  }, []);

  const removeDuplicates = useCallback(() => {
    setQueuedTracks((prev) => {
      if (prev.length <= 1) return prev;

      const seen = new Set<number>();
      const deduplicated: QueuedTrack[] = [];

      for (const qt of prev) {
        if (!seen.has(qt.track.id)) {
          seen.add(qt.track.id);
          deduplicated.push(qt);
        }
      }

      const removedCount = prev.length - deduplicated.length;
      if (removedCount > 0) {
        logger.debug(
          `[useAudioPlayer] 🧹 Removed ${removedCount} duplicate track${removedCount === 1 ? "" : "s"} from queue`,
        );
      }

      return deduplicated;
    });
  }, []);

  const cleanInvalidTracks = useCallback(() => {
    setQueuedTracks((prev) => {
      const valid = prev.filter((qt) => isValidTrack(qt.track));
      const removedCount = prev.length - valid.length;

      if (removedCount > 0) {
        logger.warn(
          `[useAudioPlayer] 🧹 Removed ${removedCount} invalid track${removedCount === 1 ? "" : "s"} from queue`,
        );
      }

      return valid;
    });
  }, [isValidTrack]);

  const cleanQueue = useCallback(() => {
    setQueuedTracks((prev) => {
      if (prev.length === 0) return prev;

      const valid = prev.filter((qt) => isValidTrack(qt.track));

      const seen = new Set<number>();
      const cleaned: QueuedTrack[] = [];

      for (const qt of valid) {
        if (!seen.has(qt.track.id)) {
          seen.add(qt.track.id);
          cleaned.push(qt);
        }
      }

      const removedInvalid = prev.length - valid.length;
      const removedDuplicates = valid.length - cleaned.length;
      const totalRemoved = removedInvalid + removedDuplicates;

      if (totalRemoved > 0) {
        logger.debug(
          `[useAudioPlayer] 🧹 Queue cleaned: removed ${removedInvalid} invalid, ${removedDuplicates} duplicate track${totalRemoved === 1 ? "" : "s"}`,
        );
      }

      return cleaned;
    });
  }, [isValidTrack]);

  const clearQueueAndHistory = useCallback(() => {
    logger.debug(
      "[useAudioPlayer] 🧹 Clearing queue and history (user session change)",
    );
    setQueuedTracks([]);
    setHistory([]);
    originalQueueOrderRef.current = [];
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    clearPersistedQueueState();
  }, []);

  const setVolumeWithValidation = useCallback((newVolume: number) => {
    if (!Number.isFinite(newVolume)) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  }, []);

  const playTrack = useCallback(
    (track: Track) => {
      if (!isValidTrack(track)) {
        logger.error(
          "[useAudioPlayer] ❌ Cannot play invalid track:",
          typeof track === "object" && track && "title" in track
            ? (track as Track).title
            : "Unknown",
        );
        return null;
      }

      const trackIndex = queue.findIndex((t) => t.id === track.id);

      if (trackIndex === -1) {
        logger.debug(
          "[useAudioPlayer] 🎵 Playing new track, inserting at queue position 0, preserving existing queue",
          {
            newTrack: track.title,
            currentQueueSize: queue.length,
          },
        );
        requestAutoPlayNext(true);
        if (queue.length > 0 && currentTrack) {
          setHistory((prev) => [...prev, currentTrack]);
        }

        setQueuedTracks((prev) => [
          createQueuedTrack(track, "user"),
          ...prev.slice(1),
        ]);
      } else if (trackIndex === 0) {
        logger.debug(
          "[useAudioPlayer] 🔄 Track already playing, restarting from beginning",
        );
        if (audioRef.current) {
          const streamUrl = getStreamUrlById(track.id.toString());

          if (audioRef.current.src !== streamUrl || !audioRef.current.src) {
            logger.debug(
              "[useAudioPlayer] Audio source missing or different, reloading track",
              {
                currentSrc: audioRef.current.src,
                expectedSrc: streamUrl,
              },
            );
            loadTrack(track, streamUrl);
          } else {
            logger.debug(
              "[useAudioPlayer] Restarting playback from beginning",
              {
                src: audioRef.current.src,
                currentTime: audioRef.current.currentTime,
                paused: audioRef.current.paused,
                readyState: audioRef.current.readyState,
              },
            );
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((error) => {
              logger.error("Playback failed:", error);
              setIsPlaying(false);

              logger.debug(
                "[useAudioPlayer] Play failed, reloading track as fallback",
              );
              loadTrack(track, streamUrl);
            });
          }
        }
      } else {
        logger.debug(
          "[useAudioPlayer] ⏩ Track found in queue at position",
          trackIndex,
          ", playing from queue",
        );
        requestAutoPlayNext(true);
        playFromQueue(trackIndex);
      }

      return track;
    },
    [
      queue,
      currentTrack,
      playFromQueue,
      isValidTrack,
      loadTrack,
      createQueuedTrack,
      requestAutoPlayNext,
    ],
  );

  return {
    currentTrack,
    queue,
    queuedTracks,
    smartQueueState,
    history,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    isLoading,
    failedTrackIds,

    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    playTrack,
    playNext: useCallback(() => {
      if (queue.length < 2) return null;

      const [currentTrack, nextTrack] = queue;

      requestAutoPlayNext(true);
      setHistory((prev) => [...prev, currentTrack!]);

      setQueuedTracks((prev) => prev.slice(1));
      return nextTrack!;
    }, [queue, requestAutoPlayNext]),
    playPrevious,
    addToQueue,
    addToPlayNext,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    playFromQueue,
    toggleShuffle,
    cycleRepeatMode,
    setVolume: setVolumeWithValidation,
    setIsMuted,
    adjustVolume,
    skipForward,
    skipBackward,
    clearFailedTrack,
    clearAllFailedTracks,

    removeDuplicates,
    cleanInvalidTracks,
    cleanQueue,
    clearQueueAndHistory,
    isValidTrack,

    addSmartTracks,
    refreshSmartTracks,
    clearSmartTracks,
    getQueueSections,

    audioRef,
  };
}
