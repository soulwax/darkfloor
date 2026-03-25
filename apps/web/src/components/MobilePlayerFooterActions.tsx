// File: apps/web/src/components/MobilePlayerFooterActions.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, ListMusic, ListPlus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

export interface MobilePlayerPlaylistOption {
  id: number;
  name: string;
  trackCount?: number | null;
}

export interface MobilePlayerFooterActionsProps {
  queueLength: number;
  showQueuePanel: boolean;
  onToggleQueuePanel: () => void;
  isAuthenticated: boolean;
  showPlaylistSelector: boolean;
  onTogglePlaylistSelector: () => void;
  onClosePlaylistSelector: () => void;
  playlists?: MobilePlayerPlaylistOption[] | null;
  onAddToPlaylist: (playlistId: number) => void;
  isAddingToPlaylist: boolean;
  onShare: () => void;
  shareCopied: boolean;
  favoriteIsActive: boolean;
  favoriteDisabled: boolean;
  isHeartAnimating: boolean;
  onToggleFavorite: () => void;
}

export function MobilePlayerFooterActions({
  queueLength,
  showQueuePanel,
  onToggleQueuePanel,
  isAuthenticated,
  showPlaylistSelector,
  onTogglePlaylistSelector,
  onClosePlaylistSelector,
  playlists,
  onAddToPlaylist,
  isAddingToPlaylist,
  onShare,
  shareCopied,
  favoriteIsActive,
  favoriteDisabled,
  isHeartAnimating,
  onToggleFavorite,
}: MobilePlayerFooterActionsProps) {
  const t = useTranslations("trackMenu");
  const tp = useTranslations("playlists");
  const tc = useTranslations("common");
  const playlistLabel = isAuthenticated
    ? t("addToPlaylist")
    : t("signInToAddToPlaylists");
  const favoriteLabel = !isAuthenticated
    ? t("signInToFavoriteTracks")
    : favoriteIsActive
      ? t("removeFromFavorites")
      : t("addToFavorites");
  const actionButtonClass =
    "touch-target rounded-full text-[var(--color-subtext)] transition-colors hover:bg-white/4 hover:text-[var(--color-text)]";
  const activeActionButtonClass =
    "touch-target rounded-full bg-white/6 text-[var(--color-accent)] transition-colors hover:text-[var(--color-text)]";

  return (
    <div
      className="mobile-player-footer-actions flex items-center justify-center gap-4 px-1 pb-1"
      data-drag-exempt="true"
      data-testid="mobile-player-footer-actions"
    >
      <motion.button
        onClick={onToggleQueuePanel}
        whileTap={{ scale: 0.9 }}
        className={`relative ${
          showQueuePanel ? activeActionButtonClass : actionButtonClass
        }`}
        aria-label={t("queue")}
        title={t("queue")}
      >
        <ListMusic className="h-5 w-5" />
        {queueLength > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-on-accent)]">
            {queueLength > 9 ? "9+" : queueLength}
          </span>
        )}
      </motion.button>

      <div className="relative" data-drag-exempt="true">
        <motion.button
          onClick={onTogglePlaylistSelector}
          whileTap={{ scale: 0.9 }}
          className={`${!isAuthenticated ? "opacity-50" : ""} ${
            showPlaylistSelector ? activeActionButtonClass : actionButtonClass
          }`}
          title={playlistLabel}
          aria-label={playlistLabel}
        >
          <ListPlus className="h-5 w-5" />
        </motion.button>

        <AnimatePresence>
          {showPlaylistSelector && isAuthenticated && (
            <>
              <div
                className="fixed inset-0 z-10"
                data-drag-exempt="true"
                onClick={onClosePlaylistSelector}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="theme-panel absolute right-0 bottom-full z-20 mb-2 max-h-72 w-64 overflow-y-auto rounded-xl border"
                data-drag-exempt="true"
              >
                <div className="border-b border-[rgba(255,255,255,0.08)] p-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">
                    {t("addToPlaylist")}
                  </h3>
                </div>
                <div className="py-2">
                  {playlists && playlists.length > 0 ? (
                    playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => onAddToPlaylist(playlist.id)}
                        disabled={isAddingToPlaylist}
                        className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white/4 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[var(--color-text)]">
                              {playlist.name}
                            </p>
                            <p className="text-xs text-[var(--color-subtext)]">
                              {tc("tracks", {
                                count: playlist.trackCount ?? 0,
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-[var(--color-subtext)]">
                        {tp("noPlaylistsYet")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {tp("noPlaylistsDescription")}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        onClick={onShare}
        whileTap={{ scale: 0.9 }}
        className={`${
          shareCopied ? activeActionButtonClass : actionButtonClass
        }`}
        title={shareCopied ? t("linkCopied") : t("shareTrack")}
        aria-label={t("shareTrack")}
      >
        {shareCopied ? (
          <Check className="h-5 w-5" />
        ) : (
          <Share2 className="h-5 w-5" />
        )}
      </motion.button>

      <motion.button
        onClick={onToggleFavorite}
        disabled={favoriteDisabled}
        whileTap={{ scale: 0.9 }}
        className={`${
          favoriteIsActive ? activeActionButtonClass : actionButtonClass
        } ${favoriteDisabled ? "opacity-50" : ""}`}
        title={favoriteLabel}
        aria-label={favoriteLabel}
      >
        <Heart
          className={`h-5 w-5 transition-transform ${favoriteIsActive ? "fill-current" : ""} ${
            isHeartAnimating ? "scale-125" : ""
          }`}
        />
      </motion.button>
    </div>
  );
}
