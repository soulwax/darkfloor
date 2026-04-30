"use client";

import { useToast } from "@/contexts/ToastContext";
import { api, type RouterOutputs } from "@starchild/api-client/trpc/react";
import {
  Ban,
  Check,
  Loader2,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useState } from "react";

type UserSummary = RouterOutputs["social"]["searchUsers"][number];
type FriendEntry = RouterOutputs["social"]["listFriends"][number];
type FriendRequest = RouterOutputs["social"]["listFriendRequests"][number];

function getDisplayName(user: UserSummary | FriendEntry["friend"] | null) {
  return user?.name ?? user?.userHash ?? "Unknown user";
}

function UserAvatar({
  user,
  size = "md",
}: {
  user: UserSummary | FriendEntry["friend"] | null;
  size?: "sm" | "md";
}) {
  const name = getDisplayName(user);
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  if (user?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Auth avatars can come from several provider domains.
      <img
        src={user.image}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] font-semibold text-[var(--color-subtext)]`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function UserLine({
  user,
  meta,
  action,
}: {
  user: UserSummary | FriendEntry["friend"] | null;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition hover:bg-[var(--color-surface-hover)]/60">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--color-text)]">
            {getDisplayName(user)}
          </div>
          {meta ? (
            <div className="truncate text-xs text-[var(--color-subtext)]">
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "success";
}) {
  const variantClass =
    variant === "danger"
      ? "hover:border-red-400/70 hover:text-red-300"
      : variant === "success"
        ? "hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        : "hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-subtext)] transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
    >
      {children}
    </button>
  );
}

export function FriendsPanel() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const friendsQuery = api.social.listFriends.useQuery();
  const requestsQuery = api.social.listFriendRequests.useQuery({
    status: "pending",
  });
  const searchQuery = api.social.searchUsers.useQuery(
    { query: trimmedSearch },
    { enabled: trimmedSearch.length >= 2 },
  );

  const pendingRequests = requestsQuery.data ?? [];
  const incomingRequests = pendingRequests.filter(
    (request) => request.recipientUserId === session?.user.id,
  );
  const outgoingRequests = pendingRequests.filter(
    (request) => request.requesterUserId === session?.user.id,
  );
  const friendIds = new Set(
    (friendsQuery.data ?? []).map((entry) => entry.friend.id),
  );
  const outgoingRecipientIds = new Set(
    outgoingRequests.map((request) => request.recipientUserId),
  );

  const refreshSocialData = async () => {
    await Promise.all([
      utils.social.listFriends.invalidate(),
      utils.social.listFriendRequests.invalidate(),
      utils.social.searchUsers.invalidate(),
    ]);
  };

  const sendRequest = api.social.sendFriendRequest.useMutation({
    onSuccess: async () => {
      showToast("Friend request sent.", "success");
      await refreshSocialData();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const respondRequest = api.social.respondToFriendRequest.useMutation({
    onSuccess: async (_, variables) => {
      showToast(
        variables.status === "accepted"
          ? "Friend request accepted."
          : "Friend request declined.",
        "success",
      );
      await refreshSocialData();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const cancelRequest = api.social.cancelFriendRequest.useMutation({
    onSuccess: async () => {
      showToast("Friend request cancelled.", "success");
      await refreshSocialData();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const removeFriend = api.social.removeFriend.useMutation({
    onSuccess: async () => {
      showToast("Friend removed.", "success");
      await refreshSocialData();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const blockUser = api.social.blockUser.useMutation({
    onSuccess: async () => {
      showToast("User blocked.", "success");
      await refreshSocialData();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const isMutating =
    sendRequest.isPending ||
    respondRequest.isPending ||
    cancelRequest.isPending ||
    removeFriend.isPending ||
    blockUser.isPending;

  const searchResults = searchQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-lg backdrop-blur-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-base font-semibold tracking-wide text-[var(--color-subtext)] uppercase">
            Friends
          </h2>
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or user hash"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50 py-2 pr-3 pl-9 text-sm text-[var(--color-text)] transition outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
            Search
          </div>
          <div className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2">
            {searchQuery.isFetching ? (
              <div className="flex h-20 items-center justify-center text-[var(--color-subtext)]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : trimmedSearch.length < 2 ? (
              <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                Type at least two characters.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                No users found.
              </p>
            ) : (
              searchResults.map((user) => {
                const isFriend = friendIds.has(user.id);
                const isPending = outgoingRecipientIds.has(user.id);

                return (
                  <UserLine
                    key={user.id}
                    user={user}
                    meta={user.userHash ?? undefined}
                    action={
                      isFriend ? (
                        <span className="rounded-md bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-subtext)]">
                          Friends
                        </span>
                      ) : isPending ? (
                        <span className="rounded-md bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-subtext)]">
                          Pending
                        </span>
                      ) : (
                        <IconButton
                          label={`Add ${getDisplayName(user)}`}
                          onClick={() =>
                            sendRequest.mutate({ recipientUserId: user.id })
                          }
                          disabled={isMutating}
                          variant="success"
                        >
                          <UserPlus className="h-4 w-4" />
                        </IconButton>
                      )
                    }
                  />
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
            Requests
          </div>
          <div className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2">
            {requestsQuery.isLoading ? (
              <div className="flex h-20 items-center justify-center text-[var(--color-subtext)]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                No pending requests.
              </p>
            ) : (
              <>
                {incomingRequests.map((request: FriendRequest) => (
                  <UserLine
                    key={request.id}
                    user={request.requester}
                    meta="Incoming"
                    action={
                      <div className="flex items-center gap-2">
                        <IconButton
                          label="Accept request"
                          onClick={() =>
                            respondRequest.mutate({
                              requestId: request.id,
                              status: "accepted",
                            })
                          }
                          disabled={isMutating}
                          variant="success"
                        >
                          <Check className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Decline request"
                          onClick={() =>
                            respondRequest.mutate({
                              requestId: request.id,
                              status: "declined",
                            })
                          }
                          disabled={isMutating}
                        >
                          <X className="h-4 w-4" />
                        </IconButton>
                      </div>
                    }
                  />
                ))}
                {outgoingRequests.map((request: FriendRequest) => (
                  <UserLine
                    key={request.id}
                    user={request.recipient}
                    meta="Outgoing"
                    action={
                      <IconButton
                        label="Cancel request"
                        onClick={() =>
                          cancelRequest.mutate({ requestId: request.id })
                        }
                        disabled={isMutating}
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    }
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
            Friends
          </div>
          <div className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-2">
            {friendsQuery.isLoading ? (
              <div className="flex h-20 items-center justify-center text-[var(--color-subtext)]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (friendsQuery.data ?? []).length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--color-subtext)]">
                No friends yet.
              </p>
            ) : (
              (friendsQuery.data ?? []).map((entry) => (
                <UserLine
                  key={entry.id}
                  user={entry.friend}
                  meta={entry.friend.userHash ?? undefined}
                  action={
                    <div className="flex items-center gap-2">
                      <IconButton
                        label={`Remove ${getDisplayName(entry.friend)}`}
                        onClick={() =>
                          removeFriend.mutate({ userId: entry.friend.id })
                        }
                        disabled={isMutating}
                      >
                        <UserMinus className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label={`Block ${getDisplayName(entry.friend)}`}
                        onClick={() =>
                          blockUser.mutate({ userId: entry.friend.id })
                        }
                        disabled={isMutating}
                        variant="danger"
                      >
                        <Ban className="h-4 w-4" />
                      </IconButton>
                    </div>
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
