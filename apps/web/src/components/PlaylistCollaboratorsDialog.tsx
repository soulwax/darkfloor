"use client";

import { useToast } from "@/contexts/ToastContext";
import { api, type RouterOutputs } from "@starchild/api-client/trpc/react";
import { Check, Loader2, UserMinus, UserPlus, Users, X } from "lucide-react";
import type { ReactNode } from "react";

type FriendEntry = RouterOutputs["social"]["listFriends"][number];
type Collaborator =
  RouterOutputs["social"]["listPlaylistCollaborators"][number];

function getDisplayName(user: FriendEntry["friend"] | Collaborator["user"]) {
  return user?.name ?? user?.userHash ?? "Unknown user";
}

function Avatar({
  user,
}: {
  user: FriendEntry["friend"] | Collaborator["user"];
}) {
  const name = getDisplayName(user);

  if (user?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Auth avatars can come from several provider domains.
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-sm font-semibold text-[var(--color-subtext)]">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function StatusBadge({ status }: { status: Collaborator["status"] }) {
  const active = status === "active";

  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        active
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
      }`}
    >
      {active ? "Active" : status}
    </span>
  );
}

function SmallButton({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-subtext)] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "hover:border-red-400/70 hover:text-red-300"
          : "hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      }`}
    >
      {children}
    </button>
  );
}

export function PlaylistCollaboratorsDialog({
  playlistId,
  playlistName,
  isOpen,
  onClose,
}: {
  playlistId: number;
  playlistName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const utils = api.useUtils();

  const friendsQuery = api.social.listFriends.useQuery(undefined, {
    enabled: isOpen,
  });
  const collaboratorsQuery = api.social.listPlaylistCollaborators.useQuery(
    { playlistId },
    { enabled: isOpen },
  );

  const refresh = async () => {
    await Promise.all([
      utils.social.listPlaylistCollaborators.invalidate({ playlistId }),
      utils.music.getPlaylist.invalidate({ id: playlistId }),
      utils.music.getPlaylists.invalidate(),
    ]);
  };

  const inviteCollaborator = api.social.invitePlaylistCollaborator.useMutation({
    onSuccess: async () => {
      showToast("Collaborator invited.", "success");
      await refresh();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const removeCollaborator = api.social.removePlaylistCollaborator.useMutation({
    onSuccess: async () => {
      showToast("Collaborator removed.", "success");
      await refresh();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  if (!isOpen) return null;

  const collaborators = collaboratorsQuery.data ?? [];
  const collaboratorByUserId = new Map(
    collaborators.map((collaborator) => [collaborator.userId, collaborator]),
  );
  const friends = friendsQuery.data ?? [];
  const isMutating =
    inviteCollaborator.isPending || removeCollaborator.isPending;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--color-accent)]">
              <Users className="h-5 w-5" />
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                Collaborators
              </h2>
            </div>
            <p className="mt-1 truncate text-sm text-[var(--color-subtext)]">
              {playlistName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collaborators"
            title="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-subtext)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              Invited
            </div>
            <div className="min-h-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-2">
              {collaboratorsQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center text-[var(--color-subtext)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : collaborators.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                  No collaborators invited yet.
                </p>
              ) : (
                collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition hover:bg-[var(--color-surface-hover)]/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar user={collaborator.user} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--color-text)]">
                          {getDisplayName(collaborator.user)}
                        </div>
                        <div className="truncate text-xs text-[var(--color-subtext)]">
                          {collaborator.role}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={collaborator.status} />
                      <SmallButton
                        label={`Remove ${getDisplayName(collaborator.user)}`}
                        onClick={() =>
                          removeCollaborator.mutate({
                            playlistId,
                            userId: collaborator.userId,
                          })
                        }
                        disabled={isMutating}
                        danger
                      >
                        <UserMinus className="h-4 w-4" />
                      </SmallButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              Friends
            </div>
            <div className="min-h-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-2">
              {friendsQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center text-[var(--color-subtext)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                  Add friends before inviting collaborators.
                </p>
              ) : (
                friends.map((entry) => {
                  const existing = collaboratorByUserId.get(entry.friend.id);
                  const isActive = existing?.status === "active";
                  const isInvited = existing?.status === "invited";

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition hover:bg-[var(--color-surface-hover)]/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar user={entry.friend} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {getDisplayName(entry.friend)}
                          </div>
                          <div className="truncate text-xs text-[var(--color-subtext)]">
                            {entry.friend.userHash ?? "Friend"}
                          </div>
                        </div>
                      </div>
                      {isActive || isInvited ? (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-accent)]">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : (
                        <SmallButton
                          label={`Invite ${getDisplayName(entry.friend)}`}
                          onClick={() =>
                            inviteCollaborator.mutate({
                              playlistId,
                              userId: entry.friend.id,
                              role: "editor",
                            })
                          }
                          disabled={isMutating}
                        >
                          <UserPlus className="h-4 w-4" />
                        </SmallButton>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
