// File: apps/web/src/components/SwipeableTrackCard.tsx

"use client";

import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { useWebShare } from "@/hooks/useWebShare";
import { api } from "@starchild/api-client/trpc/react";
import type { Track } from "@starchild/types";
import { hapticLight, hapticMedium, hapticSuccess } from "@/utils/haptics";
import { getCoverImage } from "@/utils/images";
import { springPresets } from "@/utils/spring-animations";
import { formatDuration } from "@/utils/time";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Heart, ListPlus, MoreHorizontal, Play, Share2 } from "lucide-react";
import Image from "next/image";
import { memo, useRef, useState } from "react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

export interface SwipeableTrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlayNext?: (track: Track) => void;
  showActions?: boolean;
  index?: number;
  onArtistClick?: (artistName: string) => void;
  onAlbumClick?: (albumId: number) => void;
}

const SWIPE_THRESHOLD = 80;
const SWIPE_CONFIRM_THRESHOLD = 120;

function SwipeableTrackCard({
  track,
  onPlay,
  onAddToQueue,
  onAddToPlayNext,
  showActions = true,
  index = 0,
  onArtistClick,
  onAlbumClick,
}: SwipeableTrackCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [optimisticIsFavorite, setOptimisticIsFavorite] = useState<boolean | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const utils = api.useUtils();
  const { showToast } = useToast();
  const { share } = useWebShare();
  const { openMenu } = useTrackContextMenu();

  const x = useMotionValue(0);

  const leftActionOpacity = useTransform(
    x,
    [-SWIPE_CONFIRM_THRESHOLD, -SWIPE_THRESHOLD, 0],
    [1, 0.5, 0],
  );
  const leftActionScale = useTransform(
    x,
    [-SWIPE_CONFIRM_THRESHOLD, -SWIPE_THRESHOLD, 0],
    [1.2, 1, 0.8],
  );
  const rightActionOpacity = useTransform(
    x,
    [0, SWIPE_THRESHOLD, SWIPE_CONFIRM_THRESHOLD],
    [0, 0.5, 1],
  );
  const rightActionScale = useTransform(
    x,
    [0, SWIPE_THRESHOLD, SWIPE_CONFIRM_THRESHOLD],
    [0.8, 1, 1.2],
  );
  const cardScale = useTransform(
    x,
    [-SWIPE_CONFIRM_THRESHOLD, 0, SWIPE_CONFIRM_THRESHOLD],
    [0.98, 1, 0.98],
  );

  const { data: favoriteData } = api.music.isFavorite.useQuery(
    { trackId: track.id },
    { enabled: showActions },
  );

  const resolvedIsFavorite = optimisticIsFavorite ?? favoriteData?.isFavorite;

  const addFavorite = api.music.addFavorite.useMutation({
    onMutate: () => {
      setOptimisticIsFavorite(true);
    },
    onSuccess: async () => {
      setOptimisticIsFavorite(null);
      await utils.music.isFavorite.invalidate({ trackId: track.id });
      await utils.music.getFavorites.invalidate();
      showToast(`Added "${track.title}" to favorites`, "success");
    },
    onError: (error) => {
      setOptimisticIsFavorite(null);
      showToast(`Failed to add to favorites: ${error.message}`, "error");
    },
  });

  const removeFavorite = api.music.removeFavorite.useMutation({
    onMutate: () => {
      setOptimisticIsFavorite(false);
    },
    onSuccess: async () => {
      setOptimisticIsFavorite(null);
      await utils.music.isFavorite.invalidate({ trackId: track.id });
      await utils.music.getFavorites.invalidate();
      showToast(`Removed "${track.title}" from favorites`, "info");
    },
    onError: (error) => {
      setOptimisticIsFavorite(null);
      showToast(`Failed to remove from favorites: ${error.message}`, "error");
    },
  });

  const toggleFavorite = () => {
    if (resolvedIsFavorite) {
      hapticLight();
      removeFavorite.mutate({ trackId: track.id });
    } else {
      hapticSuccess();
      addFavorite.mutate({ track });
    }
    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 600);
  };

  const handleAddToQueue = () => {
    hapticMedium();
    onAddToQueue(track);
    showToast(`Added "${track.title}" to queue`, "success");
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    const trackId = track.deezer_id ?? track.id;
    const shareUrl = `${window.location.origin}/track/${trackId}`;
    const success = await share({
      title: `${track.title} - ${track.artist.name}`,
      text: `Check out "${track.title}" by ${track.artist.name} on Starchild Music!`,
      url: shareUrl,
    });
    if (success) {
      showToast("Track shared successfully!", "success");
    }
  };

  const handlePlay = () => {
    hapticLight();
    onPlay(track);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    hapticLight();
    openMenu(track, e.clientX, e.clientY);
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (
      offset < -SWIPE_CONFIRM_THRESHOLD ||
      (offset < -SWIPE_THRESHOLD && velocity < -500)
    ) {
      handleAddToQueue();
    } else if (
      offset > SWIPE_CONFIRM_THRESHOLD ||
      (offset > SWIPE_THRESHOLD && velocity > 500)
    ) {
      toggleFavorite();
    }
  };

  const coverImage = getCoverImage(track);

  return (
    <motion.div
      ref={constraintsRef}
      className="relative !overflow-visible rounded-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springPresets.smooth, delay: index * 0.03 }}
    >
      {}
      <div className="absolute inset-0 flex overflow-hidden rounded-2xl">
        {}
        <motion.div
          style={{ opacity: rightActionOpacity }}
          className={`flex flex-1 items-center justify-start bg-gradient-to-r px-6 ${
            resolvedIsFavorite
              ? "from-[rgba(242,139,130,0.25)] to-transparent"
              : "from-[rgba(244,178,102,0.28)] to-transparent"
          }`}
        >
          <motion.div
            style={{ scale: rightActionScale }}
            className="flex items-center gap-3"
          >
            <Heart
              className={`h-7 w-7 ${
                resolvedIsFavorite
                  ? "fill-[var(--color-danger)] text-[var(--color-danger)]"
                  : "text-[var(--color-accent)]"
              }`}
            />
            <span className="text-sm font-medium text-[var(--color-text)]">
              {resolvedIsFavorite ? "Unfavorite" : "Favorite"}
            </span>
          </motion.div>
        </motion.div>

        {}
        <motion.div
          style={{ opacity: leftActionOpacity }}
          className="flex flex-1 items-center justify-end bg-gradient-to-l from-[rgba(88,198,177,0.25)] to-transparent px-6"
        >
          <motion.div
            style={{ scale: leftActionScale }}
            className="flex items-center gap-3"
          >
            <span className="text-sm font-medium text-[var(--color-text)]">
              Add to Queue
            </span>
            <ListPlus className="h-7 w-7 text-[var(--color-accent-strong)]" />
          </motion.div>
        </motion.div>
      </div>

      {}
      <motion.div
        style={{ x, scale: cardScale }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        whileTap={{ cursor: "grabbing" }}
        className="theme-panel group relative flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] p-3 transition-all hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)] md:gap-4 md:p-3.5"
      >
        {}
        <div className="relative flex-shrink-0">
          <Image
            src={coverImage}
            alt={track.title}
            width={64}
            height={64}
            className="h-14 w-14 rounded-lg shadow-md ring-1 ring-white/15 transition-all md:h-16 md:w-16"
            loading="lazy"
            quality={75}
          />
          <motion.button
            onClick={handlePlay}
            whileTap={{ scale: 0.9 }}
            transition={springPresets.immediate}
            className="absolute right-1 bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[0_8px_20px_rgba(244,178,102,0.4)] transition-all md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            <Play className="ml-0.5 h-4 w-4 fill-current text-current" />
          </motion.button>
        </div>

        {}
        <div
          className="min-w-0 flex-1 space-y-1"
          onClick={!onArtistClick && !onAlbumClick ? handlePlay : undefined}
        >
          <h3
            className="line-clamp-1 cursor-pointer text-sm leading-tight font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-accent-light)] md:text-base"
            onClick={handlePlay}
          >
            {track.title}
          </h3>
          {onArtistClick ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticLight();
                onArtistClick(track.artist.name);
              }}
              className="line-clamp-1 text-left text-xs text-[var(--color-subtext)] transition-colors hover:text-[var(--color-accent-light)] hover:underline md:text-sm"
            >
              {track.artist.name}
            </button>
          ) : (
            <p className="line-clamp-1 cursor-pointer text-xs text-[var(--color-subtext)] md:text-sm">
              {track.artist.name}
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] md:text-xs">
            {track.album ? (
              onAlbumClick ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticLight();
                    onAlbumClick(track.album.id);
                  }}
                  className="line-clamp-1 text-left transition-colors hover:text-[var(--color-accent-light)] hover:underline"
                >
                  {track.album.title}
                </button>
              ) : (
                <span className="line-clamp-1 cursor-pointer">
                  {track.album.title}
                </span>
              )
            ) : (
              <span className="line-clamp-1 text-[var(--color-muted)]">
                Unknown Album
              </span>
            )}
            <span>•</span>
            <span className="tabular-nums">
              {formatDuration(track.duration)}
            </span>
          </div>
        </div>

        {}
        <div className="flex flex-shrink-0 items-center gap-0.5 transition-opacity md:gap-1 md:opacity-0 md:group-hover:opacity-100">
          {}
          {showActions && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite();
              }}
              whileTap={{ scale: 0.85 }}
              transition={springPresets.immediate}
              className={`touch-target rounded-full p-2 transition-colors ${
                resolvedIsFavorite
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-subtext)] hover:text-[var(--color-text)]"
              }`}
              disabled={addFavorite.isPending || removeFavorite.isPending}
            >
              <Heart
                className={`h-5 w-5 md:h-[18px] md:w-[18px] ${
                  resolvedIsFavorite ? "fill-current" : ""
                } ${isHeartAnimating ? "animate-heart-pulse" : ""}`}
              />
            </motion.button>
          )}

          {}
          {showActions && (
            <motion.button
              onClick={handleShare}
              whileTap={{ scale: 0.85 }}
              transition={springPresets.immediate}
              className="touch-target rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-accent)]"
              title="Share track"
            >
              <Share2 className="h-5 w-5 md:h-[18px] md:w-[18px]" />
            </motion.button>
          )}

          {}
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              handleAddToQueue();
            }}
            whileTap={{ scale: 0.85 }}
            transition={springPresets.immediate}
            className="touch-target rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-accent-strong)]"
            title="Add to queue"
          >
            <ListPlus className="h-5 w-5 md:h-[18px] md:w-[18px]" />
          </motion.button>

          {}
          <div className="relative">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              whileTap={{ scale: 0.85 }}
              transition={springPresets.immediate}
              className="touch-target rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-text)]"
            >
              <MoreHorizontal className="h-5 w-5 md:h-[18px] md:w-[18px]" />
            </motion.button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={springPresets.snappy}
                  className="theme-panel absolute right-0 z-20 mt-2 w-56 rounded-xl border py-2 shadow-xl backdrop-blur-xl md:w-48"
                >
                  {onAddToPlayNext && (
                    <>
                      <button
                        onClick={() => {
                          onAddToPlayNext(track);
                          showToast(
                            `"${track.title}" will play next`,
                            "success",
                          );
                          setShowMenu(false);
                          hapticMedium();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[rgba(244,178,102,0.1)] md:py-2"
                      >
                        <Play className="h-4 w-4" />
                        <span>Play next</span>
                      </button>
                      <div className="mx-3 my-1 border-t border-[rgba(245,241,232,0.08)]" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      hapticLight();
                      setShowAddToPlaylistModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[rgba(244,178,102,0.1)] md:py-2"
                  >
                    <ListPlus className="h-4 w-4" />
                    <span>Add to Playlist</span>
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>

        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => setShowAddToPlaylistModal(false)}
          track={track}
        />
      </motion.div>

      {}
      {index < 2 && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 3, duration: 1 }}
          className="pointer-events-none absolute inset-0 flex items-center justify-between px-4"
        >
          <div className="flex items-center gap-2 rounded-full bg-[rgba(244,178,102,0.2)] px-3 py-1.5 text-xs text-[var(--color-accent)]">
            <span>←</span>
            <Heart className="h-3 w-3" />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[rgba(88,198,177,0.2)] px-3 py-1.5 text-xs text-[var(--color-secondary-accent)]">
            <ListPlus className="h-3 w-3" />
            <span>→</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default memo(SwipeableTrackCard);
