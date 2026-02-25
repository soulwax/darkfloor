// File: apps/web/src/components/CreatePlaylistModal.tsx

"use client";

import { useToast } from "@/contexts/ToastContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePlaylistModal({ isOpen, onClose }: CreatePlaylistModalProps) {
  const { data: session } = useSession();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const utils = api.useUtils();
  const createPlaylist = api.music.createPlaylist.useMutation({
    onSuccess: async (playlist) => {
      await utils.music.getPlaylists.invalidate();
      if (playlist) {
        showToast(`Created playlist "${playlist.name}"`, "success");
        onClose();
        setNewPlaylistName("");
        setNewPlaylistDescription("");
        setIsPublic(false);
        router.push(`/playlists/${playlist.id}`);
      }
    },
    onError: (error) => {
      showToast(`Failed to create playlist: ${error.message}`, "error");
    },
  });

  const handleCreatePlaylist = () => {
    if (!session) {
      onClose();
      openAuthModal({ callbackUrl: "/playlists" });
      return;
    }

    if (!newPlaylistName.trim()) {
      showToast("Please enter a playlist name", "error");
      return;
    }

    createPlaylist.mutate({
      name: newPlaylistName.trim(),
      description: newPlaylistDescription.trim() || undefined,
      isPublic,
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        hapticLight();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (!session) {
          onClose();
          openAuthModal({ callbackUrl: "/playlists" });
          return;
        }
        if (newPlaylistName.trim()) {
          createPlaylist.mutate({
            name: newPlaylistName.trim(),
            description: newPlaylistDescription.trim() || undefined,
            isPublic,
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, newPlaylistName, session, router, newPlaylistDescription, isPublic, createPlaylist, openAuthModal]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springPresets.gentle}
            className="theme-chrome-backdrop fixed inset-0 z-[200] backdrop-blur-sm"
            onClick={() => {
              hapticLight();
              onClose();
              setNewPlaylistName("");
              setNewPlaylistDescription("");
              setIsPublic(false);
            }}
          />

          {}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={springPresets.gentle}
            className="fixed inset-x-4 top-1/2 z-[201] -translate-y-1/2 md:right-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="surface-panel overflow-hidden p-6">
              <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
                Create Playlist
              </h2>

              {!session ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-sm text-[var(--color-subtext)]">
                    Sign in to create playlists
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onClose();
                      openAuthModal({ callbackUrl: "/playlists" });
                    }}
                    className="inline-block rounded-lg bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] px-6 py-3 text-sm font-medium text-[var(--color-on-accent)] shadow-[var(--accent-btn-shadow)] transition-all hover:scale-105 hover:shadow-[var(--accent-btn-shadow-hover)] active:scale-95"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                        Playlist Name *
                      </label>
                      <input
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="My Awesome Playlist"
                        className="theme-input w-full rounded-lg py-3 px-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] backdrop-blur-sm transition-all hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                        Description (optional)
                      </label>
                      <textarea
                        value={newPlaylistDescription}
                        onChange={(e) => setNewPlaylistDescription(e.target.value)}
                        placeholder="Add a description..."
                        rows={3}
                        className="theme-input w-full resize-none rounded-lg py-3 px-4 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] backdrop-blur-sm transition-all hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="isPublic"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
                      />
                      <label htmlFor="isPublic" className="text-sm text-[var(--color-subtext)]">
                        Make this playlist public
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        hapticLight();
                        onClose();
                        setNewPlaylistName("");
                        setNewPlaylistDescription("");
                        setIsPublic(false);
                      }}
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-3 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-hover)] active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePlaylist}
                      disabled={createPlaylist.isPending || !newPlaylistName.trim()}
                      className="flex-1 rounded-lg bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] px-4 py-3 text-sm font-medium text-[var(--color-on-accent)] shadow-[var(--accent-btn-shadow)] transition-all hover:scale-105 hover:shadow-[var(--accent-btn-shadow-hover)] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {createPlaylist.isPending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
