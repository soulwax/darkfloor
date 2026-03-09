// File: apps/web/src/components/TrackContextMenu.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsDown,
  Disc3,
  Heart,
  ListPlus,
  Play,
  Plus,
  Share2,
  SkipForward,
  Trash2,
  User,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { useWebShare } from "@/hooks/useWebShare";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight, hapticMedium, hapticSuccess } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import { useTranslations } from "next-intl";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

export function TrackContextMenu() {
  const {
    track,
    position,
    excludePlaylistId,
    removeFromList,
    queueActions,
    closeMenu,
  } = useTrackContextMenu();
  const player = useGlobalPlayer();
  const { showToast } = useToast();
  const { share, isSupported: isShareSupported } = useWebShare();
  const { data: session } = useSession();
  const t = useTranslations("trackMenu");
  const tc = useTranslations("common");
  const tm = useTranslations("metadata");
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const utils = api.useUtils();

  const { data: favoriteData } = api.music.isFavorite.useQuery(
    { trackId: track?.id ?? 0 },
    { enabled: !!track && !!session },
  );

  const addFavorite = api.music.addFavorite.useMutation({
    onSuccess: async () => {
      if (!track) return;
      await utils.music.isFavorite.invalidate({ trackId: track.id });
      await utils.music.getFavorites.invalidate();
      showToast(t("addedToFavorites", { title: track.title }), "success");
    },
    onError: (error) => {
      showToast(t("failedToAddToFavorites", { error: error.message }), "error");
    },
  });

  const removeFavorite = api.music.removeFavorite.useMutation({
    onSuccess: async () => {
      if (!track) return;
      await utils.music.isFavorite.invalidate({ trackId: track.id });
      await utils.music.getFavorites.invalidate();
      showToast(t("removedFromFavorites", { title: track.title }), "info");
    },
    onError: (error) => {
      showToast(
        t("failedToRemoveFromFavorites", { error: error.message }),
        "error",
      );
    },
  });

  useEffect(() => {
    if (!track) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [track, closeMenu]);

  useEffect(() => {
    if (!menuRef.current || !position) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let { x, y } = position;

    if (x + rect.width > viewport.width) {
      x = viewport.width - rect.width - 16;
    }

    if (y + rect.height > viewport.height) {
      y = viewport.height - rect.height - 16;
    }

    if (x < 16) {
      x = 16;
    }

    if (y < 16) {
      y = 16;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);

  const handlePlay = () => {
    if (!track) return;
    hapticMedium();
    if (queueActions?.onPlayFromQueue) {
      queueActions.onPlayFromQueue();
    } else {
      player.playTrack(track);
    }
    closeMenu();
  };

  const handleAddToQueue = () => {
    if (!track) return;
    hapticLight();
    player.addToQueue(track);
    showToast(t("addedToQueue", { title: track.title }), "success");
    closeMenu();
  };

  const handleAddToPlayNext = () => {
    if (!track) return;
    hapticLight();
    if (queueActions?.onMoveToNext) {
      queueActions.onMoveToNext();
      showToast(t("movedPlayNext", { title: track.title }), "success");
    } else {
      player.addToPlayNext(track);
      showToast(t("willPlayNext", { title: track.title }), "success");
    }
    closeMenu();
  };

  const handleMoveToEnd = () => {
    if (!track || !queueActions?.onMoveToEnd) return;
    hapticLight();
    queueActions.onMoveToEnd();
    showToast(t("movedToEnd", { title: track.title }), "success");
    closeMenu();
  };

  const handleToggleFavorite = () => {
    if (!track) return;

    if (favoriteData?.isFavorite) {
      hapticLight();
      removeFavorite.mutate({ trackId: track.id });
    } else {
      hapticSuccess();
      addFavorite.mutate({ track });
    }
    closeMenu();
  };

  const handleAddToPlaylist = () => {
    hapticLight();
    setShowAddToPlaylistModal(true);
    closeMenu();
  };

  const handleShare = async () => {
    if (!track) return;
    hapticLight();

    const shareUrl = `${window.location.origin}/track/${track.id}`;

    if (isShareSupported) {
      const success = await share({
        title: tm("trackByArtist", {
          title: track.title,
          artist: track.artist.name,
        }),
        text: tm("listenTo", {
          title: track.title,
          artist: track.artist.name,
          album: track.album?.title ?? "none",
        }),
        url: shareUrl,
      });

      if (success) {
        showToast(t("trackShared"), "success");
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(t("linkCopied"), "success");
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        showToast(t("failedToCopyLink"), "error");
      }
    }
    closeMenu();
  };

  const handleGoToArtist = () => {
    if (!track) return;
    hapticLight();
    window.location.href = `/artist/${track.artist.id}`;
    closeMenu();
  };

  const handleGoToAlbum = () => {
    if (!track) return;
    hapticLight();
    window.location.href = `/album/${track.album.id}`;
    closeMenu();
  };

  if (!track || !position) return null;

  const isQueuedItem = !!queueActions?.isQueued;
  const canMoveToNext = !!queueActions?.onMoveToNext;
  const canMoveToEnd = !!queueActions?.onMoveToEnd;

  return (
    <>
      <AnimatePresence>
        {track && position && (
          <>
            {}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springPresets.gentle}
              className="theme-chrome-backdrop fixed inset-0 z-[102]"
              onClick={closeMenu}
            />

            {}
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={springPresets.snappy}
              className="theme-panel fixed z-[103] flex items-center gap-1 rounded-xl border p-2 shadow-xl backdrop-blur-xl"
              style={{
                left: position.x,
                top: position.y,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {}
              <button
                onClick={handlePlay}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title={t("playNow")}
              >
                <Play className="h-5 w-5 text-[var(--color-accent)] transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  {tc("play")}
                </span>
              </button>

              {}
              <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />

              {}
              {!isQueuedItem && (
                <button
                  onClick={handleAddToQueue}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                  title={t("addToQueue")}
                >
                  <Plus className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    {t("queue")}
                  </span>
                </button>
              )}

              {}
              <button
                onClick={handleAddToPlayNext}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                title={isQueuedItem ? t("movePlayNext") : t("playNext")}
                disabled={isQueuedItem && !canMoveToNext}
              >
                <SkipForward className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  {t("next")}
                </span>
              </button>

              {}
              {isQueuedItem && (
                <button
                  onClick={handleMoveToEnd}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  title={t("moveLast")}
                  disabled={!canMoveToEnd}
                >
                  <ChevronsDown className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    {t("last")}
                  </span>
                </button>
              )}

              {}
              <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />

              {}
              {session && (
                <button
                  onClick={handleToggleFavorite}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                  title={
                    favoriteData?.isFavorite
                      ? t("removeFromFavorites")
                      : t("addToFavorites")
                  }
                  disabled={addFavorite.isPending || removeFavorite.isPending}
                >
                  <Heart
                    className={`h-5 w-5 transition-all group-hover:scale-110 ${
                      favoriteData?.isFavorite
                        ? "fill-[var(--color-danger)] text-[var(--color-danger)]"
                        : "text-[var(--color-subtext)] group-hover:text-[var(--color-accent)]"
                    }`}
                  />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    {favoriteData?.isFavorite ? t("saved") : tc("save")}
                  </span>
                </button>
              )}

              {}
              {session && (
                <button
                  onClick={handleAddToPlaylist}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                  title={t("addToPlaylist")}
                >
                  <ListPlus className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    {t("playlist")}
                  </span>
                </button>
              )}

              {}
              {(session ?? isShareSupported) && (
                <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />
              )}

              {}
              {isShareSupported && (
                <button
                  onClick={handleShare}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                  title={t("shareTrack")}
                >
                  <Share2 className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    {tc("share")}
                  </span>
                </button>
              )}

              {}
              <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />

              {}
              <button
                onClick={handleGoToArtist}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title={t("goToArtist")}
              >
                <User className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  {tc("artist")}
                </span>
              </button>

              {}
              <button
                onClick={handleGoToAlbum}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title={t("goToAlbum")}
              >
                <Disc3 className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  {tc("album")}
                </span>
              </button>

              {}
              {removeFromList && (
                <>
                  <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      const onRemove = removeFromList.onRemove;
                      onRemove();
                      closeMenu();
                    }}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[var(--color-danger)]/15 active:scale-95"
                    title={removeFromList.label}
                  >
                    <Trash2 className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-danger)]" />
                    <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                      {removeFromList.label}
                    </span>
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {}
      {track && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => setShowAddToPlaylistModal(false)}
          track={track}
          excludePlaylistId={excludePlaylistId}
        />
      )}
    </>
  );
}
