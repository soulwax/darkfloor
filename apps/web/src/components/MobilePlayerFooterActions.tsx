// File: apps/web/src/components/MobilePlayerFooterActions.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, ListMusic, ListPlus } from "lucide-react";

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
  favoriteIsActive,
  favoriteDisabled,
  isHeartAnimating,
  onToggleFavorite,
}: MobilePlayerFooterActionsProps) {
  const playlistLabel = isAuthenticated
    ? "Add to playlist"
    : "Sign in to add to playlists";
  const favoriteLabel = !isAuthenticated
    ? "Sign in to favorite tracks"
    : favoriteIsActive
      ? "Remove from favorites"
      : "Add to favorites";

  return (
    <div
      className="mobile-player-footer-actions flex items-center justify-center gap-4 px-1 pb-1"
      data-drag-exempt="true"
      data-testid="mobile-player-footer-actions"
    >
      <motion.button
        onClick={onToggleQueuePanel}
        whileTap={{ scale: 0.9 }}
        className={`touch-target relative ${
          showQueuePanel ? "text-[var(--color-accent)]" : "text-[var(--color-subtext)]"
        }`}
        aria-label="Show queue"
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
          className={`touch-target ${!isAuthenticated ? "opacity-50" : ""} ${
            showPlaylistSelector ? "text-[var(--color-accent)]" : "text-[var(--color-subtext)]"
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
                className="theme-panel absolute bottom-full right-0 z-20 mb-2 max-h-72 w-64 overflow-y-auto rounded-xl border shadow-xl backdrop-blur-xl"
                data-drag-exempt="true"
              >
                <div className="border-b border-[rgba(255,255,255,0.08)] p-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Add to Playlist</h3>
                </div>
                <div className="py-2">
                  {playlists && playlists.length > 0 ? (
                    playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => onAddToPlaylist(playlist.id)}
                        disabled={isAddingToPlaylist}
                        className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-[rgba(244,178,102,0.1)] disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[var(--color-text)]">
                              {playlist.name}
                            </p>
                            <p className="text-xs text-[var(--color-subtext)]">
                              {playlist.trackCount ?? 0} {playlist.trackCount === 1 ? "track" : "tracks"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-[var(--color-subtext)]">No playlists yet</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Create one from the Playlists page
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
        onClick={onToggleFavorite}
        disabled={favoriteDisabled}
        whileTap={{ scale: 0.9 }}
        className={`touch-target transition-all ${
          favoriteIsActive ? "text-red-500" : "text-[var(--color-subtext)]"
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
