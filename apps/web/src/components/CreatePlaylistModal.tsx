"use client";

import { useToast } from "@/contexts/ToastContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight } from "@/utils/haptics";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePlaylistModal({
  isOpen,
  onClose,
}: CreatePlaylistModalProps) {
  const tc = useTranslations("common");
  const tp = useTranslations("playlists");
  const { data: session } = useSession();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const { showToast } = useToast();

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const resetForm = () => {
    setNewPlaylistName("");
    setNewPlaylistDescription("");
    setIsPublic(false);
  };

  const closeModal = () => {
    onClose();
    resetForm();
  };

  const utils = api.useUtils();
  const createPlaylist = api.music.createPlaylist.useMutation({
    onSuccess: async (playlist) => {
      await utils.music.getPlaylists.invalidate();
      if (playlist) {
        showToast(tp("createdPlaylist", { name: playlist.name }), "success");
        closeModal();
        router.push(`/playlists/${playlist.id}`);
      }
    },
    onError: (error) => {
      showToast(tp("failedToCreate", { error: error.message }), "error");
    },
  });

  const handleCreatePlaylist = () => {
    if (!session) {
      closeModal();
      openAuthModal({ callbackUrl: "/playlists" });
      return;
    }

    if (!newPlaylistName.trim()) {
      showToast(tp("pleaseEnterName"), "error");
      return;
    }

    createPlaylist.mutate({
      name: newPlaylistName.trim(),
      description: newPlaylistDescription.trim() || undefined,
      isPublic,
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          hapticLight();
          closeModal();
        }
      }}
    >
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-md p-0"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleCreatePlaylist();
          }
        }}
      >
        <div className="p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle>{tp("createPlaylist")}</DialogTitle>
            <DialogDescription>
              {session ? tp("descriptionOptional") : tp("signInToCreate")}
            </DialogDescription>
          </DialogHeader>

          {!session ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  closeModal();
                  openAuthModal({ callbackUrl: "/playlists" });
                }}
                className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold"
              >
                {tc("signIn")}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                    {tp("playlistNameRequired")}
                  </label>
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(event) => setNewPlaylistName(event.target.value)}
                    placeholder={tp("playlistNamePlaceholder")}
                    className="theme-input w-full rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                    {tp("descriptionOptional")}
                  </label>
                  <textarea
                    value={newPlaylistDescription}
                    onChange={(event) =>
                      setNewPlaylistDescription(event.target.value)
                    }
                    placeholder={tp("descriptionPlaceholder")}
                    rows={3}
                    className="theme-input w-full resize-none rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)]"
                  />
                </div>

                <label className="shell-panel-muted flex items-center gap-3 px-3 py-3 text-sm text-[var(--color-subtext)]">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]"
                  />
                  <span>{tp("makePublic")}</span>
                </label>
              </div>

              <DialogFooter className="mt-6 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    closeModal();
                  }}
                  className="btn-secondary flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                >
                  {tc("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleCreatePlaylist}
                  disabled={createPlaylist.isPending || !newPlaylistName.trim()}
                  className="btn-primary flex-1 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {createPlaylist.isPending ? tp("creating") : tc("create")}
                </button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
