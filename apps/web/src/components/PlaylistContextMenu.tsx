// File: apps/web/src/components/PlaylistContextMenu.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Plus,
  Share2,
  Edit3,
  ExternalLink,
  Trash2,
  Copy,
  Lock,
  Unlock,
  GitMerge,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Track } from "@starchild/types";

import { usePlaylistContextMenu } from "@/contexts/PlaylistContextMenuContext";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useWebShare } from "@/hooks/useWebShare";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight, hapticMedium } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";

export function PlaylistContextMenu() {
  const { playlist, position, options, closeMenu } = usePlaylistContextMenu();
  const player = useGlobalPlayer();
  const { showToast } = useToast();
  const { share } = useWebShare();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const utils = api.useUtils();
  const addToPlaylist = api.music.addToPlaylist.useMutation();

  const deletePlaylist = api.music.deletePlaylist.useMutation({
    onSuccess: async () => {
      showToast(`Deleted playlist "${playlist?.name}"`, "success");
      await utils.music.getPlaylists.invalidate();
      closeMenu();
    },
    onError: (error) => {
      showToast(`Failed to delete playlist: ${error.message}`, "error");
    },
  });

  const updateVisibility = api.music.updatePlaylistVisibility.useMutation({
    onSuccess: async (data) => {
      showToast(
        `Playlist is now ${data.isPublic ? "public" : "private"}`,
        "success",
      );
      await utils.music.getPlaylists.invalidate();
      closeMenu();
    },
    onError: (error) => {
      showToast(`Failed to update visibility: ${error.message}`, "error");
    },
  });

  const duplicatePlaylist = api.music.createPlaylist.useMutation({
    onSuccess: async (newPlaylist) => {
      if (!playlist || !newPlaylist) return;

      if (playlist.tracks && playlist.tracks.length > 0) {
        await Promise.all(
          playlist.tracks.map((pt) =>
            addToPlaylist.mutateAsync({
              playlistId: newPlaylist.id,
              track: pt.track,
            }),
          ),
        );
      }

      showToast(`Duplicated "${playlist.name}" successfully`, "success");
      await utils.music.getPlaylists.invalidate();
      closeMenu();
    },
    onError: (error) => {
      showToast(`Failed to duplicate playlist: ${error.message}`, "error");
    },
  });

  useEffect(() => {
    if (!playlist) return;

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
  }, [playlist, closeMenu]);

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
    if (x < 16) x = 16;

    if (y + rect.height > viewport.height) {
      y = viewport.height - rect.height - 16;
    }
    if (y < 16) y = 16;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);

  const isOwnerMenu = options.mode !== "foreign";
  const playlistPath = options.openPath ?? `/playlists/${playlist?.id ?? 0}`;
  const canShare = playlist?.isPublic ?? true;

  const resolveMenuTracks = async (): Promise<Track[]> => {
    if (!playlist) return [];

    if (options.resolveTracks) {
      return options.resolveTracks();
    }

    try {
      const ownedPlaylist = await utils.music.getPlaylist.fetch({
        id: playlist.id,
      });
      return [...(ownedPlaylist.tracks ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((pt) => pt.track);
    } catch (error) {
      console.error(
        "Failed to fetch owned playlist, falling back to public playlist:",
        error,
      );
      // Fall back to public playlist resolution for non-owned/public contexts.
    }
    try {
      const publicPlaylist = await utils.music.getPublicPlaylist.fetch({
        id: playlist.id,
      });
      return [...(publicPlaylist.tracks ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((pt) => pt.track);
    } catch (error) {
      console.error("Failed to resolve public playlist tracks:", error);
      return [];
    }
  };

  const handlePlayAll = async () => {
    if (!playlist) return;

    hapticMedium();

    try {
      const tracks = await resolveMenuTracks();
      if (tracks.length === 0) {
        showToast("This playlist has no tracks", "info");
        closeMenu();
        return;
      }

      const [first, ...rest] = tracks;

      if (first) {
        player.clearQueue();
        player.playTrack(first);
        if (rest.length > 0) {
          player.addToQueue(rest);
        }
        showToast(
          `Playing "${playlist.name}" (${tracks.length} tracks)`,
          "success",
        );
      }
    } catch (error) {
      console.error("Failed to fetch full playlist:", error);
      showToast("Failed to load playlist tracks", "error");
    }

    closeMenu();
  };

  const handleAddAllToQueue = async () => {
    if (!playlist) return;

    hapticLight();

    try {
      const tracks = await resolveMenuTracks();
      if (tracks.length === 0) {
        showToast("This playlist has no tracks", "info");
        closeMenu();
        return;
      }

      player.addToQueue(tracks);
      showToast(`Added ${tracks.length} tracks to queue`, "success");
    } catch (error) {
      console.error("Failed to fetch full playlist:", error);
      showToast("Failed to load playlist tracks", "error");
    }

    closeMenu();
  };

  const handleMergePlaylist = () => {
    hapticLight();
    setShowMergeModal(true);
  };

  const handleShare = async () => {
    if (!playlist) return;

    if (!canShare) {
      showToast("Only public playlists can be shared", "info");
      closeMenu();
      return;
    }

    hapticLight();
    const url = options.shareUrl ?? `${window.location.origin}${playlistPath}`;

    const success = await share({
      title: `${playlist.name} - Starchild Music`,
      text: `Check out this playlist: ${playlist.name}${playlist.description ? ` - ${playlist.description}` : ""}`,
      url,
    });

    if (success) {
      showToast("Playlist shared successfully!", "success");
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard!", "success");
      } catch {
        showToast("Failed to share playlist", "error");
      }
    }
    closeMenu();
  };

  const handleEdit = () => {
    if (!playlist || !isOwnerMenu) return;
    hapticLight();
    router.push(`/playlists/${playlist.id}`);
    closeMenu();
  };

  const handleOpen = () => {
    if (!playlist) return;
    hapticLight();
    router.push(playlistPath);
    closeMenu();
  };

  const handleToggleVisibility = () => {
    if (!playlist || !isOwnerMenu) return;
    hapticMedium();
    updateVisibility.mutate({
      id: playlist.id,
      isPublic: !(playlist.isPublic ?? false),
    });
  };

  const handleDelete = () => {
    if (!playlist || !isOwnerMenu) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${playlist.name}"? This cannot be undone.`,
    );

    if (confirmed) {
      hapticMedium();
      deletePlaylist.mutate({ id: playlist.id });
    } else {
      closeMenu();
    }
  };

  const handleDuplicate = () => {
    if (!playlist || !isOwnerMenu) return;

    hapticLight();
    duplicatePlaylist.mutate({
      name: `${playlist.name} (Copy)`,
      description: playlist.description ?? undefined,
      isPublic: false,
    });
  };

  if (!playlist || !position) return null;

  return (
    <>
      <AnimatePresence>
        {playlist && position && (
          <>
            {}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springPresets.gentle}
              className="theme-chrome-backdrop fixed inset-0 z-[70]"
              onClick={closeMenu}
            />

            {}
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={springPresets.snappy}
              className="theme-panel fixed z-[71] flex items-center gap-1 rounded-xl border p-2 shadow-xl backdrop-blur-xl"
              style={{
                left: position.x,
                top: position.y,
              }}
            >
              {}
              <button
                onClick={handlePlayAll}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title="Play all tracks"
              >
                <Play className="h-5 w-5 text-[var(--color-accent)] transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  Play
                </span>
              </button>

              {}
              <button
                onClick={handleAddAllToQueue}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title="Add all to queue"
              >
                <Plus className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  Queue
                </span>
              </button>

              {isOwnerMenu && (
                <>
                  <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />
                  <button
                    onClick={handleMergePlaylist}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                    title="Merge with another playlist"
                  >
                    <GitMerge className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                    <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                      Merge
                    </span>
                  </button>
                </>
              )}

              {}
              <button
                onClick={handleShare}
                className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                title={
                  canShare
                    ? "Share playlist"
                    : "Only public playlists can be shared"
                }
                disabled={!canShare}
              >
                <Share2
                  className={`h-5 w-5 transition-all group-hover:scale-110 ${
                    canShare
                      ? "text-[var(--color-subtext)] group-hover:text-[var(--color-accent)]"
                      : "text-[var(--color-muted)]"
                  }`}
                />
                <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                  Share
                </span>
              </button>

              <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />

              {isOwnerMenu ? (
                <>
                  <button
                    onClick={handleEdit}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                    title="Edit playlist"
                  >
                    <Edit3 className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                    <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                      Edit
                    </span>
                  </button>

                  <button
                    onClick={handleToggleVisibility}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                    title={playlist.isPublic ? "Make private" : "Make public"}
                    disabled={updateVisibility.isPending}
                  >
                    {playlist.isPublic ? (
                      <Unlock className="h-5 w-5 text-[var(--color-accent)] transition-all group-hover:scale-110" />
                    ) : (
                      <Lock className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                    )}
                    <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                      {playlist.isPublic ? "Public" : "Private"}
                    </span>
                  </button>

                  <button
                    onClick={handleDuplicate}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                    title="Duplicate playlist"
                    disabled={duplicatePlaylist.isPending}
                  >
                    <Copy className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                    <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                      Copy
                    </span>
                  </button>

                  <div className="h-10 w-px bg-[rgba(244,178,102,0.15)]" />

                  <button
                    onClick={handleDelete}
                    className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] hover:bg-red-500/10 active:scale-95"
                    title="Delete playlist"
                    disabled={deletePlaylist.isPending}
                  >
                    <Trash2 className="h-5 w-5 text-[var(--color-danger)] transition-all group-hover:scale-110" />
                    <span className="text-[10px] font-medium text-[var(--color-danger)] group-hover:text-red-400">
                      Delete
                    </span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOpen}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all hover:bg-[rgba(244,178,102,0.15)] active:scale-95"
                  title="Open playlist"
                >
                  <ExternalLink className="h-5 w-5 text-[var(--color-subtext)] transition-all group-hover:scale-110 group-hover:text-[var(--color-accent)]" />
                  <span className="text-[10px] font-medium text-[var(--color-subtext)] group-hover:text-[var(--color-text)]">
                    Open
                  </span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {}
      {showMergeModal && (
        <div className="theme-chrome-backdrop fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="surface-panel max-w-md p-6">
            <h3 className="mb-4 text-xl font-bold text-[var(--color-text)]">
              Merge Playlists
            </h3>
            <p className="mb-4 text-sm text-[var(--color-subtext)]">
              Merge functionality coming soon! This will allow you to combine
              tracks from multiple playlists.
            </p>
            <button
              onClick={() => {
                setShowMergeModal(false);
                closeMenu();
              }}
              className="btn-primary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
