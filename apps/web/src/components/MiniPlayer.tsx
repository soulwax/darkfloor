// File: apps/web/src/components/MiniPlayer.tsx

"use client";

import type { Track } from "@starchild/types";
import { hapticLight, hapticMedium } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import Image from "next/image";
import { AutoQueueBadge } from "./AutoQueueBadge";

interface MiniPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Track[];
  lastAutoQueueCount?: number;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onTap: () => void;
  onToggleQueue?: () => void;
}

export default function MiniPlayer({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  queue: _queue,
  lastAutoQueueCount = 0,
  onPlayPause,
  onNext: _onNext,
  onSeek,
  onTap,
  onToggleQueue,
}: MiniPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, -50], [1, 0.85]);
  const scale = useTransform(dragY, [0, -50], [1, 0.96]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onSeek(percentage * duration);
    e.stopPropagation();
  };

  const handleProgressTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
    e.stopPropagation();
  };

  const shouldIgnoreTap = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest("button") ??
      target.closest("input") ??
      target.closest("select") ??
      target.closest("[data-drag-exempt='true']"),
    );
  };

  const handleContainerTap = (event: PointerEvent | MouseEvent | TouchEvent) => {

    if (shouldIgnoreTap(event.target)) {
      return;
    }
    hapticLight();
    onTap();
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const offset = info.offset.y;
    const velocity = info.velocity.y;

    if (offset < -20 || velocity < -150) {
      hapticMedium();
      onTap();
    }

    dragY.set(0);
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      transition={springPresets.gentle}
      className="theme-chrome-bar safe-bottom fixed right-0 left-0 z-[60] bottom-16 border-t backdrop-blur-2xl md:bottom-0"
    >
      { }
      <AutoQueueBadge count={lastAutoQueueCount} />

      { }
      <div
        className="slider-track h-1 w-full cursor-pointer"
        data-drag-exempt="true"
        onClick={handleProgressClick}
        onTouchMove={handleProgressTouch}
      >
        <div
          className="accent-gradient h-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      { }
      <motion.div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 relative"
        onTap={handleContainerTap}
        drag="y"
        dragConstraints={{ top: -80, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragEnd={handleDragEnd}
        style={{ y: dragY, opacity, scale }}
        whileTap={{ scale: 0.99 }}
        transition={springPresets.snappy}
      >
        {currentTrack.album.cover_small ? (
          <Image
            src={currentTrack.album.cover_small}
            alt={currentTrack.title}
            width={48}
            height={48}
            className="flex-shrink-0 rounded-md shadow-md"
            priority
            quality={75}
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-[rgba(244,178,102,0.12)] text-[var(--color-muted)]">
            🎵
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium text-[var(--color-text)]">
            {currentTrack.title}
          </h4>
          <p className="truncate text-xs text-[var(--color-subtext)]">
            {currentTrack.artist.name}
          </p>
        </div>
        {onToggleQueue && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              hapticLight();
              onToggleQueue();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              hapticLight();
              onToggleQueue();
            }}
            data-drag-exempt="true"
            whileTap={{ scale: 0.88 }}
            transition={springPresets.snappy}
            className="touch-target flex-shrink-0 text-[var(--color-subtext)] rounded-full p-1.5"
            aria-label="Open queue"
            type="button"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
            </svg>
          </motion.button>
        )}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            hapticLight();
            onPlayPause();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            hapticLight();
            onPlayPause();
          }}
          data-drag-exempt="true"
          whileTap={{ scale: 0.88 }}
          transition={springPresets.snappy}
          className="touch-target flex-shrink-0 text-[var(--color-text)] rounded-full p-1.5"
          aria-label={isPlaying ? "Pause track" : "Play track"}
          type="button"
        >
          {isPlaying ? (
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
