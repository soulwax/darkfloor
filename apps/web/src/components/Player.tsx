// File: apps/web/src/components/Player.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { api } from "@starchild/api-client/trpc/react";
import type { Track } from "@starchild/types";
import { hapticLight, hapticMedium, hapticSuccess } from "@/utils/haptics";
import { formatTime } from "@/utils/time";
import {
  Heart,
  Layers,
  ListPlus,
  Maximize2,
  Minimize2,
  Shuffle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";

interface PlayerProps {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "none" | "one" | "all";
  isLoading: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onToggleQueue?: () => void;
  onToggleEqualizer?: () => void;
  onToggleVisualizer?: () => void;
  visualizerEnabled?: boolean;
  onTogglePatternControls?: () => void;
}

export default function MaturePlayer({
  currentTrack,
  queue,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffled,
  repeatMode,
  isLoading,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onSkipForward,
  onSkipBackward,
  onToggleQueue,
  onToggleEqualizer,
  onToggleVisualizer,
  visualizerEnabled,
  onTogglePatternControls,
}: PlayerProps) {
  const t = useTranslations("player");
  const tq = useTranslations("queue");
  const tm = useTranslations("trackMenu");
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const { hideUI, setHideUI } = useGlobalPlayer();
  const { openMenu } = useTrackContextMenu();

  const utils = api.useUtils();
  const { data: session } = useSession();
  const isAuthenticated = !!session;

  const { data: favoriteData } = api.music.isFavorite.useQuery(
    { trackId: currentTrack?.id ?? 0 },
    { enabled: !!currentTrack && isAuthenticated },
  );

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

  const toggleFavorite = () => {
    if (!currentTrack) return;

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

  const handlePlayPause = () => {
    hapticMedium();
    onPlayPause();
  };

  const handleNext = () => {
    hapticLight();
    onNext();
  };

  const handlePrevious = () => {
    hapticLight();
    onPrevious();
  };

  const handleToggleShuffle = () => {
    hapticLight();
    onToggleShuffle();
  };

  const handleCycleRepeat = () => {
    hapticLight();
    onCycleRepeat();
  };

  const handlePlayerContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!currentTrack) return;
      event.preventDefault();
      event.stopPropagation();
      hapticLight();
      openMenu(currentTrack, event.clientX, event.clientY);
    },
    [currentTrack, openMenu],
  );

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  };

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const iconButtonClass =
    "rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]";
  const activeIconButtonClass =
    "rounded-full bg-white/6 p-2 text-[var(--color-accent)] transition-colors hover:text-[var(--color-text)]";

  return (
    <div className="w-full" onContextMenu={handlePlayerContextMenu}>
      {}
      <div
        ref={progressRef}
        className="slider-track group relative h-1 w-full cursor-pointer rounded-full transition-[height] hover:h-1.5"
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={handleProgressDrag}
        onMouseLeave={() => setIsDragging(false)}
      >
        <div
          className="accent-gradient h-full rounded-full shadow-sm transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute h-2.5 w-2.5 rounded-full bg-[var(--color-text)] opacity-90 transition-opacity group-hover:opacity-100"
          style={{
            left: `${progress}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        {}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex-shrink-0">
            {currentTrack.album.cover_small ? (
              <Image
                src={currentTrack.album.cover_small}
                alt={currentTrack.title}
                width={56}
                height={56}
                className="rounded-lg"
                priority
                quality={75}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white/4 text-[var(--color-muted)]">
                🎵
              </div>
            )}
            {isLoading && (
              <div className="theme-card-overlay absolute inset-0 flex items-center justify-center rounded-md">
                <div className="border-accent h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium text-[var(--color-text)]">
              {currentTrack.title}
            </h4>
            <p className="truncate text-sm text-[var(--color-subtext)]">
              {currentTrack.artist.name}
            </p>
          </div>

          {}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setShowAddToPlaylistModal(true);
            }}
            className={iconButtonClass}
            title={tm("addToPlaylist")}
            aria-label={tm("addToPlaylist")}
          >
            <ListPlus className="h-5 w-5" />
          </button>

          {}
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={addFavorite.isPending || removeFavorite.isPending}
            className={`rounded-full p-2 transition-all ${
              favoriteData?.isFavorite
                ? "bg-white/6 text-[var(--color-accent)]"
                : "text-[var(--color-subtext)] hover:bg-white/4 hover:text-[var(--color-text)]"
            } ${addFavorite.isPending || removeFavorite.isPending ? "opacity-50" : ""}`}
            title={
              favoriteData?.isFavorite
                ? tm("removeFromFavorites")
                : tm("addToFavorites")
            }
            aria-label={
              favoriteData?.isFavorite
                ? tm("removeFromFavorites")
                : tm("addToFavorites")
            }
          >
            <Heart
              className={`h-5 w-5 transition-transform ${
                favoriteData?.isFavorite ? "fill-current" : ""
              } ${isHeartAnimating ? "scale-125" : ""}`}
            />
          </button>
        </div>

        {}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {}
            <button
              type="button"
              onClick={handleToggleShuffle}
              className={`rounded-full p-2 transition-colors ${
                isShuffled ? activeIconButtonClass : iconButtonClass
              }`}
              title={t("shuffleShortcut")}
              aria-label={t("shuffleShortcut")}
            >
              <Shuffle className="h-4 w-4" />
            </button>

            {}
            <button
              type="button"
              onClick={handlePrevious}
              className={iconButtonClass}
              title={t("previousTrackShortcut")}
              aria-label={t("previousTrack")}
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </button>

            {}
            <button
              type="button"
              onClick={onSkipBackward}
              className={iconButtonClass}
              title={t("skipBackwardShortcut")}
              aria-label={t("skipBackward10Seconds")}
            >
              <svg
                className="h-5 w-5"
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
            </button>

            {}
            <button
              type="button"
              onClick={handlePlayPause}
              className="desktop-play-btn flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity hover:opacity-90 active:opacity-80"
              title={t("playPauseShortcut")}
              aria-label={isPlaying ? t("pauseTrack") : t("playTrack")}
            >
              {isPlaying ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="ml-0.5 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {}
            <button
              type="button"
              onClick={onSkipForward}
              className={iconButtonClass}
              title={t("skipForwardShortcut")}
              aria-label={t("skipForward10Seconds")}
            >
              <svg
                className="h-5 w-5"
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
            </button>

            {}
            <button
              type="button"
              onClick={handleNext}
              className={iconButtonClass}
              disabled={queue.length === 0}
              title={t("nextTrackShortcut")}
              aria-label={t("nextTrack")}
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
              </svg>
            </button>

            {}
            <button
              type="button"
              onClick={handleCycleRepeat}
              className={`rounded-full p-2 transition-colors ${
                repeatMode !== "none" ? activeIconButtonClass : iconButtonClass
              }`}
              title={t("repeatShortcut", {
                mode:
                  repeatMode === "one"
                    ? t("repeatModeOne")
                    : repeatMode === "all"
                      ? t("repeatModeAll")
                      : t("repeatModeOff"),
              })}
              aria-label={t("repeatShortcut", {
                mode:
                  repeatMode === "one"
                    ? t("repeatModeOne")
                    : repeatMode === "all"
                      ? t("repeatModeAll")
                      : t("repeatModeOff"),
              })}
            >
              {repeatMode === "one" ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                  <text
                    x="12"
                    y="16"
                    fontSize="10"
                    fill="currentColor"
                    textAnchor="middle"
                  >
                    1
                  </text>
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          </div>

          {}
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-subtext)]">
            <span>{formatTime(currentTime)}</span>
            <span className="text-[var(--color-muted)]">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {}
        <div className="flex flex-1 items-center justify-end gap-3">
          {}
          {queue.length > 0 && (
            <span className="hidden text-sm text-[var(--color-subtext)] lg:block">
              {t("inQueue", { count: queue.length })}
            </span>
          )}

          {}
          {}
          <div className="relative hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={onToggleMute}
              className={iconButtonClass}
              title={t("muteShortcut")}
              aria-label={t("muteShortcut")}
            >
              {isMuted || volume === 0 ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : volume < 0.5 ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            <div className="flex w-24 items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="slider-track accent-accent h-1 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, var(--color-slider-fill) 0%, var(--color-slider-fill) ${volume * 100}%, var(--color-slider-track) ${volume * 100}%, var(--color-slider-track) 100%)`,
                }}
                title={t("volumeShortcut")}
                aria-label={t("volumeShortcut")}
              />
            </div>
          </div>

          {}
          {onToggleQueue && (
            <button
              type="button"
              onClick={onToggleQueue}
              className={iconButtonClass}
              title={t("queueShortcut")}
              aria-label={tq("title", { count: queue.length })}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          {}
          {onToggleEqualizer && (
            <button
              type="button"
              onClick={onToggleEqualizer}
              className={iconButtonClass}
              title={t("equalizerShortcut")}
              aria-label={t("equalizerShortcut")}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </button>
          )}

          {}
          {onToggleVisualizer && (
            <button
              type="button"
              onClick={onToggleVisualizer}
              className={`rounded-full p-2 transition-colors ${
                visualizerEnabled ? activeIconButtonClass : iconButtonClass
              }`}
              title={
                visualizerEnabled ? t("hideVisualizer") : t("showVisualizer")
              }
              aria-label={
                visualizerEnabled ? t("hideVisualizer") : t("showVisualizer")
              }
              aria-pressed={visualizerEnabled}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
                />
                <path
                  strokeLinecap="round"
                  strokeWidth={2}
                  d="M3 16c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
                />
              </svg>
            </button>
          )}

          {}
          {onTogglePatternControls && visualizerEnabled && (
            <button
              type="button"
              onClick={onTogglePatternControls}
              className={iconButtonClass}
              title={t("patternControls")}
              aria-label={t("patternControls")}
            >
              <Layers className="h-5 w-5" />
            </button>
          )}

          {}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setHideUI(!hideUI);
            }}
            className={`rounded-full p-2 transition-colors ${
              hideUI ? activeIconButtonClass : iconButtonClass
            }`}
            title={hideUI ? t("showUi") : t("hideUi")}
            aria-label={hideUI ? t("showUi") : t("hideUi")}
            aria-pressed={hideUI}
          >
            {hideUI ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {}
      <AddToPlaylistModal
        isOpen={showAddToPlaylistModal}
        onClose={() => setShowAddToPlaylistModal(false)}
        track={currentTrack}
      />
    </div>
  );
}
