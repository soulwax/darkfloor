"use client";

import { PlaylistCollaboratorsDialog } from "@/components/PlaylistCollaboratorsDialog";
import { PlaylistArtwork } from "@/components/PlaylistArtwork";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useTrackContextMenu } from "@/contexts/TrackContextMenuContext";
import { api, type RouterOutputs } from "@starchild/api-client/trpc/react";
import { cn } from "@/lib/utils";
import { getCoverImage } from "@/utils/images";
import { formatDuration } from "@/utils/time";
import type { Track } from "@starchild/types";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  GripVertical,
  ListPlus,
  Lock,
  LogOut,
  MoreHorizontal,
  Play,
  Save,
  Share2,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";

type PlaylistTrackEntry = {
  id: number;
  track: Track;
  position: number;
  addedAt: Date | string | null;
  addedByUserId?: string | null;
  addedBy?: {
    id: string;
    name: string | null;
    image: string | null;
    userHash: string | null;
  } | null;
};

type PlaylistCollaboratorEntry =
  RouterOutputs["social"]["listPlaylistCollaborators"][number];
type UserSummary = PlaylistCollaboratorEntry["user"];

function formatAddedDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getUserDisplayName(user: UserSummary | null | undefined) {
  return user?.name ?? user?.userHash ?? "Unknown user";
}

function CollaboratorAvatar({
  user,
  index,
}: {
  user: UserSummary;
  index: number;
}) {
  const name = getUserDisplayName(user);

  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Auth avatars can come from several provider domains.
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        title={name}
        className="relative h-7 w-7 rounded-full border border-[var(--color-bg)] object-cover"
        style={{ zIndex: 20 - index }}
      />
    );
  }

  return (
    <div
      title={name}
      className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-bg)] bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-subtext)]"
      style={{ zIndex: 20 - index }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function PlaylistDetailPage() {
  const t = useTranslations("playlists");
  const tc = useTranslations("common");
  const tm = useTranslations("playlistMenu");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playlistId = parseInt(params.id);
  const player = useGlobalPlayer();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { openMenu } = useTrackContextMenu();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedTrackEntryId, setSelectedTrackEntryId] = useState<
    number | null
  >(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localVisibility, setLocalVisibility] = useState<boolean | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isCollaboratorsDialogOpen, setIsCollaboratorsDialogOpen] =
    useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const {
    data: privatePlaylist,
    isLoading: isLoadingPrivate,
    error: privatePlaylistError,
  } = api.music.getPlaylist.useQuery(
    { id: playlistId },
    { enabled: !!session && !isNaN(playlistId), retry: false },
  );

  const shouldLoadPublicPlaylist =
    !isNaN(playlistId) &&
    (!session || privatePlaylistError?.message === "Playlist not found");

  const { data: publicPlaylist, isLoading: isLoadingPublic } =
    api.music.getPublicPlaylist.useQuery(
      { id: playlistId },
      { enabled: shouldLoadPublicPlaylist, retry: false },
    );

  const playlist = privatePlaylist ?? publicPlaylist;
  const isLoading = isLoadingPrivate || isLoadingPublic;
  const sortedTracks = useMemo<PlaylistTrackEntry[]>(() => {
    const tracks = playlist?.tracks;
    if (!Array.isArray(tracks)) return [];

    return [...(tracks as PlaylistTrackEntry[])].sort(
      (a, b) => a.position - b.position,
    );
  }, [playlist?.tracks]);

  const sessionUserId = session?.user.id ?? null;
  const isOwner =
    !!sessionUserId &&
    (playlist?.userId === sessionUserId ||
      playlist?.owner?.id === sessionUserId);
  const canEditTracks = !!session && !!privatePlaylist;

  const utils = api.useUtils();
  const collaboratorsQuery = api.social.listPlaylistCollaborators.useQuery(
    { playlistId },
    {
      enabled: !!session && !!privatePlaylist && !isNaN(playlistId),
      retry: false,
    },
  );
  const updateVisibilityMutation =
    api.music.updatePlaylistVisibility.useMutation();
  const updateMetadataMutation = api.music.updatePlaylistMetadata.useMutation();
  const removeFromPlaylist = api.music.removeFromPlaylist.useMutation({
    onSuccess: async () => {
      try {
        await utils.music.getPlaylist.invalidate({ id: playlistId });
        await utils.music.getPublicPlaylist.invalidate({ id: playlistId });
      } catch (error) {
        console.error("Failed to invalidate playlist cache:", error);
      }
    },
    onError: (error) => {
      console.error("Failed to remove track:", error);
      alert(t("failedToRemoveTrack"));
    },
  });

  const reorderPlaylistMutation = api.music.reorderPlaylist.useMutation({
    onSuccess: async () => {
      try {
        await utils.music.getPlaylist.invalidate({ id: playlistId });
        await utils.music.getPublicPlaylist.invalidate({ id: playlistId });
      } catch (error) {
        console.error("Failed to invalidate playlist cache:", error);
      }
    },
    onError: (error) => {
      console.error("Failed to reorder playlist:", error);
      alert(t("failedToReorderPlaylist"));
    },
  });

  const deletePlaylist = api.music.deletePlaylist.useMutation({
    onSuccess: () => {
      router.push("/playlists");
    },
    onError: (error) => {
      console.error("Failed to delete playlist:", error);
      alert(t("failedToDeletePlaylist"));
    },
  });

  const leavePlaylist = api.social.leavePlaylistCollaborator.useMutation({
    onSuccess: async () => {
      showToast("You left the playlist.", "success");
      await Promise.all([
        utils.music.getPlaylist.invalidate({ id: playlistId }),
        utils.music.getPlaylists.invalidate(),
        utils.social.listMyPlaylistCollaboratorInvites.invalidate(),
      ]);
      router.push("/playlists");
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const handlePlayAll = (): void => {
    if (sortedTracks.length === 0) return;

    const [first, ...rest] = sortedTracks;
    if (first) {
      player.clearQueue();
      player.playTrack(first.track);
      if (rest.length > 0) {
        player.addToQueue(rest.map((t) => t.track));
      }
    }
  };

  const handlePlayTrack = (item: PlaylistTrackEntry): void => {
    setSelectedTrackEntryId(item.id);
    player.playTrack(item.track);
  };

  const handleRemoveTrack = (trackEntryId: number): void => {
    if (confirm(t("confirmRemove"))) {
      removeFromPlaylist.mutate({ playlistId, trackEntryId });
    }
  };

  const handleSharePlaylist = async (): Promise<void> => {
    const canShare = localVisibility ?? playlist?.isPublic ?? false;

    if (!canShare) {
      alert(t("onlyPublicCanShare"));
      return;
    }

    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert(t("failedToCopyLink"));
    }
  };

  // Sync draft state with playlist data - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from server data */
  useEffect(() => {
    if (playlist) {
      setLocalVisibility(playlist.isPublic);
      setDraftTitle(playlist.name ?? "");
      setDraftDescription(playlist.description ?? "");
    }
  }, [playlist]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleToggleVisibility = async (): Promise<void> => {
    if (!playlist) return;

    const currentVisibility = localVisibility ?? playlist.isPublic;
    const nextVisibility = !currentVisibility;

    setLocalVisibility(nextVisibility);

    try {
      await updateVisibilityMutation.mutateAsync({
        id: playlist.id,
        isPublic: nextVisibility,
      });
      await Promise.all([
        utils.music.getPlaylist.invalidate({ id: playlistId }),
        utils.music.getPublicPlaylist.invalidate({ id: playlistId }),
        utils.music.getPlaylists.invalidate(),
      ]);
      showToast(
        nextVisibility ? t("playlistNowPublic") : t("playlistNowPrivate"),
        "success",
      );
    } catch (error) {
      console.error("Failed to update playlist visibility:", error);
      setLocalVisibility(playlist.isPublic);
      showToast(t("failedToUpdateVisibility"), "error");
    }
  };

  const handleSaveMetadata = async () => {
    if (!playlist) return;

    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      showToast(t("playlistNameEmpty"), "error");
      return;
    }

    try {
      await updateMetadataMutation.mutateAsync({
        id: playlist.id,
        name: trimmedTitle !== playlist.name ? trimmedTitle : undefined,
        description:
          draftDescription.trim() !== (playlist.description ?? "")
            ? draftDescription.trim()
            : undefined,
      });

      await Promise.all([
        utils.music.getPlaylist.invalidate({ id: playlistId }),
        utils.music.getPublicPlaylist.invalidate({ id: playlistId }),
        utils.music.getPlaylists.invalidate(),
      ]);

      setIsEditingTitle(false);
      setIsEditingDescription(false);
      showToast(t("playlistDetailsUpdated"), "success");
    } catch (error) {
      console.error("Failed to update playlist metadata:", error);
      showToast(t("failedToUpdateDetails"), "error");
    }
  };

  const isSavingMetadata = updateMetadataMutation.isPending;

  const handleDragStart = (index: number): void => {
    setDraggedIndex(index);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    _index: number,
  ): void => {
    e.preventDefault();
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    dropIndex: number,
  ): Promise<void> => {
    e.preventDefault();

    if (
      draggedIndex === null ||
      draggedIndex === dropIndex ||
      !playlist?.tracks ||
      !canEditTracks
    ) {
      setDraggedIndex(null);
      return;
    }

    const draggedTrack = sortedTracks[draggedIndex];

    if (!draggedTrack) {
      setDraggedIndex(null);
      return;
    }

    const newTracks = [...sortedTracks];
    newTracks.splice(draggedIndex, 1);
    newTracks.splice(dropIndex, 0, draggedTrack);

    const trackUpdates = newTracks.map((item, idx) => ({
      trackEntryId: item.id,
      newPosition: idx,
    }));

    try {
      await reorderPlaylistMutation.mutateAsync({ playlistId, trackUpdates });
    } catch (error) {
      console.error("Failed to reorder tracks:", error);
    }

    setDraggedIndex(null);
  };

  const handleDragEnd = (): void => {
    setDraggedIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-accent inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-[var(--color-subtext)]">
            {t("playlistNotFound")}
          </p>
          <Link href="/playlists" className="text-accent hover:underline">
            {t("backToPlaylists")}
          </Link>
        </div>
      </div>
    );
  }

  const effectiveIsPublic = localVisibility ?? playlist.isPublic ?? false;
  const isDirty =
    draftTitle.trim() !== (playlist.name ?? "") ||
    draftDescription.trim() !== (playlist.description ?? "");
  const effectiveSelectedTrackEntryId =
    selectedTrackEntryId !== null &&
    sortedTracks.some((track) => track.id === selectedTrackEntryId)
      ? selectedTrackEntryId
      : (sortedTracks[0]?.id ?? null);
  const selectedTrack =
    sortedTracks.find((track) => track.id === effectiveSelectedTrackEntryId) ??
    sortedTracks[0] ??
    null;
  const ownerLabel =
    playlist.owner?.name ?? session?.user?.name ?? session?.user?.email ?? null;
  const activeCollaborators = (collaboratorsQuery.data ?? []).filter(
    (collaborator) => collaborator.status === "active",
  );
  const isCollaborator = canEditTracks && !isOwner;

  return (
    <div className="flex min-h-screen flex-col pb-32">
      {}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">
        {}
        <div className="mb-6">
          <div className="mb-6 flex items-start gap-4 md:gap-6">
            <Link
              href="/playlists"
              className="mt-1 text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <PlaylistArtwork
              name={playlist.name}
              tracks={sortedTracks}
              coverImage={playlist.coverImage}
              className="relative hidden h-36 w-36 shrink-0 overflow-hidden rounded-md bg-[var(--color-surface)] shadow-2xl ring-1 ring-white/10 sm:block md:h-44 md:w-44"
              sizes="176px"
              priority
            />
            <div className="min-w-0 flex-1 self-end">
              <div className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                Playlist
              </div>
              {isOwner ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {isEditingTitle ? (
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="input-text w-full text-4xl font-bold md:text-6xl"
                        maxLength={256}
                      />
                    ) : (
                      <h1 className="truncate text-4xl leading-tight font-black text-[var(--color-text)] md:text-6xl">
                        {playlist.name}
                      </h1>
                    )}
                    <button
                      onClick={() => setIsEditingTitle((prev) => !prev)}
                      className="btn-secondary px-3 py-1 text-sm"
                    >
                      {isEditingTitle ? tc("cancel") : tc("rename")}
                    </button>
                  </div>
                  <div className="flex items-start gap-3">
                    {isEditingDescription ? (
                      <textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        className="input-text h-full min-h-[90px] w-full"
                        rows={3}
                        maxLength={1024}
                        placeholder={t("descriptionPlaceholder")}
                      />
                    ) : playlist.description ? (
                      <p className="max-w-3xl text-sm text-[var(--color-subtext)]">
                        {playlist.description}
                      </p>
                    ) : (
                      <p className="text-[var(--color-muted)] italic">
                        {t("noDescription")}
                      </p>
                    )}
                    <button
                      onClick={() => setIsEditingDescription((prev) => !prev)}
                      className="btn-secondary px-3 py-1 text-sm"
                    >
                      {isEditingDescription
                        ? tc("cancel")
                        : t("editDescription")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="mb-2 truncate text-4xl leading-tight font-black text-[var(--color-text)] md:text-6xl">
                    {playlist.name}
                  </h1>
                  {playlist.description && (
                    <p className="mb-4 max-w-3xl text-sm text-[var(--color-subtext)]">
                      {playlist.description}
                    </p>
                  )}
                </>
              )}
              <div className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
                {ownerLabel && (
                  <span className="font-medium text-[var(--color-subtext)]">
                    {ownerLabel}
                  </span>
                )}
                <span>{tc("tracks", { count: sortedTracks.length })}</span>
                {activeCollaborators.length > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="flex -space-x-2">
                      {activeCollaborators
                        .slice(0, 4)
                        .map((collaborator, index) => (
                          <CollaboratorAvatar
                            key={collaborator.id}
                            user={collaborator.user}
                            index={index}
                          />
                        ))}
                    </span>
                    <span>
                      {activeCollaborators.length === 1
                        ? "1 collaborator"
                        : `${activeCollaborators.length} collaborators`}
                    </span>
                  </span>
                )}
                <span
                  className={
                    effectiveIsPublic
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-subtext)]"
                  }
                >
                  {effectiveIsPublic ? tc("public") : tc("private")}
                </span>
                <span>
                  {t("created", {
                    date: new Date(playlist.createdAt).toLocaleDateString(),
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handlePlayAll}
              className="btn-primary flex h-11 w-11 items-center justify-center rounded-full p-0"
              disabled={!playlist.tracks || playlist.tracks.length === 0}
              title={tm("playAll")}
              aria-label={tm("playAll")}
            >
              <Play className="h-5 w-5" />
            </button>

            {isOwner && (
              <button
                onClick={handleToggleVisibility}
                className="btn-secondary flex h-11 w-11 items-center justify-center rounded-full p-0"
                disabled={updateVisibilityMutation.isPending}
                title={
                  effectiveIsPublic ? t("makePrivate") : t("makePublicAction")
                }
                aria-label={
                  effectiveIsPublic ? t("makePrivate") : t("makePublicAction")
                }
              >
                {updateVisibilityMutation.isPending ? (
                  <div className="spinner spinner-sm h-5 w-5" />
                ) : effectiveIsPublic ? (
                  <Unlock className="h-5 w-5" />
                ) : (
                  <Lock className="h-5 w-5" />
                )}
              </button>
            )}

            {isCollaborator && (
              <button
                onClick={() => {
                  if (confirm("Leave this collaborative playlist?")) {
                    leavePlaylist.mutate({ playlistId });
                  }
                }}
                className="btn-secondary flex h-11 w-11 items-center justify-center rounded-full p-0"
                disabled={leavePlaylist.isPending}
                title="Leave playlist"
                aria-label="Leave playlist"
              >
                {leavePlaylist.isPending ? (
                  <div className="spinner spinner-sm h-5 w-5" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleSaveMetadata}
                className="btn-primary flex h-11 w-11 items-center justify-center rounded-full p-0 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isDirty || isSavingMetadata}
                title={t("saveChanges")}
                aria-label={t("saveChanges")}
              >
                {isSavingMetadata ? (
                  <div className="spinner spinner-sm h-5 w-5" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
              </button>
            )}

            {effectiveIsPublic && (
              <button
                onClick={handleSharePlaylist}
                className="btn-secondary flex h-11 w-11 items-center justify-center rounded-full p-0"
                title={copiedLink ? t("copied") : tc("share")}
                aria-label={t("sharePlaylist")}
              >
                <Share2 className="h-5 w-5" />
              </button>
            )}

            {isOwner && (
              <button
                onClick={() => setIsCollaboratorsDialogOpen(true)}
                className="btn-secondary flex h-11 w-11 items-center justify-center rounded-full p-0"
                title="Collaborators"
                aria-label="Manage collaborators"
              >
                <Users className="h-5 w-5" />
              </button>
            )}

            {isOwner && (
              <button
                onClick={() => {
                  if (confirm(t("confirmDelete"))) {
                    deletePlaylist.mutate({ id: playlistId });
                  }
                }}
                className="btn-danger flex h-11 w-11 items-center justify-center rounded-full p-0"
                title={t("deletePlaylist")}
                aria-label={t("deletePlaylist")}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {}
        {canEditTracks && playlist.tracks && playlist.tracks.length > 0 && (
          <div className="mb-4 rounded-md bg-[var(--color-surface-hover)] px-4 py-2 text-sm text-[var(--color-subtext)]">
            {t("dragTip")}
          </div>
        )}

        {}
        {sortedTracks.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="sticky top-0 z-10 hidden grid-cols-[44px_minmax(220px,1.4fr)_minmax(160px,0.9fr)_minmax(150px,0.8fr)_minmax(120px,0.7fr)_72px_128px] items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-2 text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase backdrop-blur md:grid">
                <div>#</div>
                <div>Title</div>
                <div>Album</div>
                <div>Added by</div>
                <div>Added at</div>
                <div className="flex justify-end">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div />
              </div>

              <div className="mt-2 space-y-1">
                {sortedTracks.map((item, index) => {
                  const isSelected = effectiveSelectedTrackEntryId === item.id;
                  const trackAddedAt = formatAddedDate(item.addedAt);
                  const rowAddedByLabel =
                    item.addedBy?.name ??
                    item.addedBy?.userHash ??
                    trackAddedAt;

                  return (
                    <div
                      key={item.id}
                      draggable={canEditTracks}
                      onClick={() => setSelectedTrackEntryId(item.id)}
                      onDoubleClick={() => handlePlayTrack(item)}
                      onDragStart={
                        canEditTracks ? () => handleDragStart(index) : undefined
                      }
                      onDragOver={
                        canEditTracks
                          ? (e) => handleDragOver(e, index)
                          : undefined
                      }
                      onDrop={
                        canEditTracks ? (e) => handleDrop(e, index) : undefined
                      }
                      onDragEnd={canEditTracks ? handleDragEnd : undefined}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMenu(item.track, event.clientX, event.clientY, {
                          excludePlaylistId: playlistId,
                          removeFromList: canEditTracks
                            ? {
                                label: t("removeFromPlaylist"),
                                onRemove: () => handleRemoveTrack(item.id),
                              }
                            : undefined,
                        });
                      }}
                      className={cn(
                        "group grid cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                        "grid-cols-[32px_minmax(0,1fr)_72px]",
                        "md:grid-cols-[44px_minmax(220px,1.4fr)_minmax(160px,0.9fr)_minmax(150px,0.8fr)_minmax(120px,0.7fr)_72px_128px] md:px-4",
                        isSelected
                          ? "bg-[rgba(255,255,255,0.12)] text-[var(--color-text)]"
                          : "text-[var(--color-subtext)] hover:bg-[rgba(255,255,255,0.07)]",
                        draggedIndex === index ? "opacity-50" : "opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-2 text-[var(--color-muted)]">
                        {canEditTracks ? (
                          <GripVertical className="hidden h-4 w-4 cursor-move opacity-0 transition group-hover:opacity-100 md:block" />
                        ) : null}
                        <span className="w-5 text-right group-hover:hidden">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePlayTrack(item);
                          }}
                          className="hidden h-5 w-5 items-center justify-center text-[var(--color-text)] group-hover:flex"
                          aria-label={`Play ${item.track.title}`}
                          title={`Play ${item.track.title}`}
                        >
                          <Play className="h-4 w-4 fill-current" />
                        </button>
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-[var(--color-surface)]">
                          <Image
                            src={getCoverImage(item.track, "small")}
                            alt={item.track.album?.title ?? item.track.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`truncate font-semibold ${
                              isSelected
                                ? "text-[var(--color-accent)]"
                                : "text-[var(--color-text)]"
                            }`}
                          >
                            {item.track.title}
                          </div>
                          <div className="truncate text-xs text-[var(--color-muted)]">
                            {item.track.artist?.name ?? "Unknown artist"}
                          </div>
                        </div>
                      </div>

                      <div className="hidden truncate md:block">
                        {item.track.album?.title ?? "—"}
                      </div>
                      <div className="hidden truncate md:block">
                        {rowAddedByLabel}
                      </div>
                      <div className="hidden truncate md:block">
                        {trackAddedAt}
                      </div>
                      <div className="justify-self-end text-xs tabular-nums md:text-sm">
                        {formatDuration(item.track.duration)}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            player.addToQueue(item.track);
                          }}
                          className="hidden h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)] md:flex"
                          aria-label="Add to queue"
                          title="Add to queue"
                        >
                          <ListPlus className="h-4 w-4" />
                        </button>
                        {canEditTracks && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveTrack(item.id);
                            }}
                            className="hidden h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition hover:bg-white/10 hover:text-[var(--color-danger)] md:flex"
                            aria-label={t("removeFromPlaylist")}
                            title={t("removeFromPlaylist")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMenu(item.track, event.clientX, event.clientY, {
                              excludePlaylistId: playlistId,
                              removeFromList: canEditTracks
                                ? {
                                    label: t("removeFromPlaylist"),
                                    onRemove: () => handleRemoveTrack(item.id),
                                  }
                                : undefined,
                            });
                          }}
                          className="h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)] md:flex"
                          aria-label="More options"
                          title="More options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
                {selectedTrack ? (
                  <div>
                    <div className="mb-4 text-sm font-semibold text-[var(--color-text)]">
                      {playlist.name}
                    </div>
                    <div className="relative mb-4 aspect-square overflow-hidden rounded-md bg-[var(--color-surface-hover)]">
                      <Image
                        src={getCoverImage(selectedTrack.track, "xl")}
                        alt={
                          selectedTrack.track.album?.title ??
                          selectedTrack.track.title
                        }
                        fill
                        sizes="328px"
                        className="object-cover"
                      />
                    </div>
                    <h2 className="line-clamp-2 text-2xl leading-tight font-bold text-[var(--color-text)]">
                      {selectedTrack.track.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-subtext)]">
                      {selectedTrack.track.artist?.name ?? "Unknown artist"}
                    </p>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                          Album
                        </dt>
                        <dd className="mt-1 text-[var(--color-text)]">
                          {selectedTrack.track.album?.title ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                          Added by
                        </dt>
                        <dd className="mt-1 text-[var(--color-text)]">
                          {selectedTrack.addedBy?.name ??
                            selectedTrack.addedBy?.userHash ??
                            formatAddedDate(selectedTrack.addedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                          Added at
                        </dt>
                        <dd className="mt-1 text-[var(--color-text)]">
                          {formatAddedDate(selectedTrack.addedAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : (
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-[var(--color-muted)]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
            <p className="mb-2 text-[var(--color-subtext)]">
              {t("emptyPlaylist")}
            </p>
            <Link href="/" className="text-accent hover:underline">
              {t("searchToAdd")}
            </Link>
          </div>
        )}
      </main>
      {isOwner ? (
        <PlaylistCollaboratorsDialog
          playlistId={playlist.id}
          playlistName={playlist.name}
          isOpen={isCollaboratorsDialogOpen}
          onClose={() => setIsCollaboratorsDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
