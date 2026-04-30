// File: apps/web/src/app/playlists/page.tsx

"use client";

import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@starchild/ui/LoadingSpinner";
import { PlaylistArtwork } from "@/components/PlaylistArtwork";
import { useToast } from "@/contexts/ToastContext";
import { usePlaylistContextMenu } from "@/contexts/PlaylistContextMenuContext";
import {
  api,
  ImportM3u8PlaylistError,
  type ImportM3u8PlaylistInput,
  type ImportM3u8PlaylistResponse,
} from "@starchild/api-client/trpc/react";
import { authFetch } from "@/services/spotifyAuthClient";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import {
  CircleAlert,
  CircleCheck,
  ListMusic,
  Loader2,
  Music,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

export const dynamic = "force-dynamic";

type M3u8ImportPayload = ImportM3u8PlaylistInput;
type M3u8MatchedTrack = ImportM3u8PlaylistResponse["matchedTracks"][number];
type M3u8UnmatchedTrack =
  ImportM3u8PlaylistResponse["importReport"]["unmatched"][number];

const M3U8_FILE_NAME_PATTERN = /\.(?:m3u8?|txt)$/i;

function getM3u8PlaylistName(fileName: string): string {
  return fileName.replace(M3U8_FILE_NAME_PATTERN, "").trim() || fileName;
}

function isM3u8FileName(fileName: string): boolean {
  return /\.(?:m3u8?)$/i.test(fileName);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getMatchedTrackTitle(track: M3u8MatchedTrack): string {
  const record = asRecord(track.deezerTrack);
  return (
    readString(record?.title_short) ??
    readString(record?.title) ??
    `Deezer #${track.deezerTrackId}`
  );
}

function getMatchedTrackArtist(track: M3u8MatchedTrack): string | null {
  const record = asRecord(track.deezerTrack);
  const artist = asRecord(record?.artist);
  return readString(artist?.name);
}

function getMatchedTrackCover(track: M3u8MatchedTrack): string | null {
  const record = asRecord(track.deezerTrack);
  const album = asRecord(record?.album);
  return (
    readString(album?.cover_medium) ??
    readString(album?.cover_small) ??
    readString(album?.cover) ??
    null
  );
}

function normalizeM3u8ImportError(
  error: unknown,
  translate: (key: string, values?: Record<string, string | number>) => string,
): string {
  const message = error instanceof Error ? error.message : "";
  const lowerMessage = message.toLowerCase();
  const status = error instanceof ImportM3u8PlaylistError ? error.status : null;

  if (status === 401) {
    return translate("m3u8Unauthorized");
  }

  if (status === 400) {
    if (lowerMessage.includes("hls") || lowerMessage.includes("ext-x")) {
      return translate("m3u8HlsRejected");
    }

    if (
      lowerMessage.includes("too many") ||
      lowerMessage.includes("200") ||
      lowerMessage.includes("track limit")
    ) {
      return translate("m3u8TooManyTracks");
    }

    if (
      lowerMessage.includes("1 mb") ||
      lowerMessage.includes("1mb") ||
      lowerMessage.includes("content over")
    ) {
      return translate("m3u8ContentTooLarge");
    }

    return translate("m3u8InvalidPlaylist");
  }

  return message || translate("m3u8ImportFailedGeneric");
}

function M3u8ImportDialog(props: {
  isOpen: boolean;
  isSubmitting: boolean;
  isReadingFile: boolean;
  payload: M3u8ImportPayload | null;
  result: ImportM3u8PlaylistResponse | null;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const {
    error,
    isOpen,
    isReadingFile,
    isSubmitting,
    onClose,
    onConfirm,
    payload,
    result,
  } = props;
  const t = useTranslations("playlists");
  const tc = useTranslations("common");

  if (!isOpen) return null;

  const matchedTracks = result?.matchedTracks ?? [];
  const unmatchedTracks = result?.importReport.unmatched ?? [];
  const playlistName =
    payload?.playlistName ?? result?.importReport.sourcePlaylistName ?? "";
  const canCreate = Boolean(
    payload &&
    result &&
    !result.playlistCreated &&
    result.importReport.matchedCount > 0 &&
    !isSubmitting,
  );

  return (
    <>
      <div
        className="theme-chrome-backdrop fixed inset-0 z-50 backdrop-blur-sm"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />
      <div className="fixed inset-x-3 top-1/2 z-50 max-h-[88vh] -translate-y-1/2 md:right-auto md:left-1/2 md:w-full md:max-w-4xl md:-translate-x-1/2">
        <div className="surface-panel flex max-h-[88vh] flex-col overflow-hidden">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 py-4 md:px-6 md:py-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                {t("m3u8ImportReviewEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--color-text)] md:text-2xl">
                {result?.playlistCreated
                  ? t("m3u8ImportCreatedTitle")
                  : t("m3u8ImportReviewTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-subtext)]">
                {result?.playlistCreated
                  ? t("m3u8ImportCreatedDescription", {
                      name: result.playlist?.name ?? playlistName,
                    })
                  : t("m3u8ImportReviewDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-2 text-[var(--color-subtext)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
              aria-label={tc("close")}
              title={tc("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {isReadingFile || (isSubmitting && !result) ? (
              <div className="rounded-[1.25rem] border border-[rgba(244,178,102,0.24)] bg-[linear-gradient(160deg,rgba(244,178,102,0.16),rgba(15,23,42,0.78))] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(244,178,102,0.28)] bg-[rgba(244,178,102,0.14)]">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">
                      {isReadingFile
                        ? t("m3u8FileReadingTitle")
                        : t("m3u8PreviewLoadingTitle")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-subtext)]">
                      {isReadingFile
                        ? t("m3u8FileReadingDescription")
                        : t("m3u8PreviewLoadingDescription")}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-4 text-sm leading-6 text-red-200">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {result ? (
              <div className="space-y-5">
                <div
                  className={`rounded-[1.25rem] border p-5 ${
                    result.playlistCreated
                      ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)]"
                      : "border-[rgba(244,178,102,0.24)] bg-[var(--color-surface-hover)]/55"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                          result.playlistCreated
                            ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.14)] text-green-200"
                            : "border-[rgba(244,178,102,0.28)] bg-[rgba(244,178,102,0.14)] text-[var(--color-accent)]"
                        }`}
                      >
                        {result.playlistCreated ? (
                          <CircleCheck className="h-5 w-5" />
                        ) : (
                          <ListMusic className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-[var(--color-text)]">
                          {result.playlist?.name ?? playlistName}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-subtext)]">
                          {t("m3u8ImportSummary", {
                            total: result.importReport.totalTracks,
                            matched: result.importReport.matchedCount,
                            unmatched: result.importReport.unmatchedCount,
                            skipped: result.importReport.skippedCount,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          labelKey: "m3u8MatchedLabel",
                          count: result.importReport.matchedCount,
                        },
                        {
                          labelKey: "m3u8UnmatchedLabel",
                          count: result.importReport.unmatchedCount,
                        },
                        {
                          labelKey: "m3u8SkippedLabel",
                          count: result.importReport.skippedCount,
                        },
                      ].map(({ labelKey, count }) => (
                        <div
                          key={labelKey}
                          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3 py-2 text-center"
                        >
                          <p className="text-lg font-semibold text-[var(--color-text)]">
                            {count}
                          </p>
                          <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--color-subtext)] uppercase">
                            {t(labelKey)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      {t("m3u8ResolvedTracksTitle")}
                    </h3>
                    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                      {matchedTracks.length > 0 ? (
                        matchedTracks.map((track) => {
                          const title = getMatchedTrackTitle(track);
                          const artist = getMatchedTrackArtist(track);
                          const cover = getMatchedTrackCover(track);

                          return (
                            <div
                              key={`${track.index}-${track.deezerTrackId}`}
                              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3"
                            >
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-muted)]/20">
                                {cover ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={cover}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Music className="h-4 w-4 text-[var(--color-subtext)]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                  {title}
                                </p>
                                <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                  {artist ?? tc("unknownArtist")}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 text-sm text-[var(--color-subtext)]">
                          {t("m3u8NoResolvedTracks")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      {t("m3u8UnresolvedTracksTitle")}
                    </h3>
                    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                      {unmatchedTracks.length > 0 ? (
                        unmatchedTracks.map((track: M3u8UnmatchedTrack) => (
                          <div
                            key={`${track.index}-${track.name}`}
                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                  {track.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                  {track.artist ?? tc("unknownArtist")}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--color-subtext)] uppercase">
                                {track.reason}
                              </span>
                            </div>
                            {track.candidates && track.candidates.length > 0 ? (
                              <div className="mt-3 space-y-1">
                                {track.candidates
                                  .slice(0, 3)
                                  .map((candidate) => (
                                    <p
                                      key={candidate.deezerTrackId}
                                      className="truncate rounded-xl border border-[rgba(244,178,102,0.2)] bg-[rgba(244,178,102,0.08)] px-3 py-2 text-xs text-[var(--color-subtext)]"
                                    >
                                      {candidate.title}
                                      {candidate.artist
                                        ? ` - ${candidate.artist}`
                                        : ""}
                                    </p>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 text-sm text-[var(--color-subtext)]">
                          {t("m3u8NoUnresolvedTracks")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border)] px-4 py-4 sm:flex-row sm:justify-end md:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isReadingFile}
              className="btn-secondary touch-target-lg disabled:opacity-50"
            >
              {result?.playlistCreated ? tc("close") : tc("cancel")}
            </button>
            {result && !result.playlistCreated ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canCreate}
                className="btn-primary touch-target-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("m3u8CreatingPlaylist")}
                  </>
                ) : (
                  t("m3u8CreatePlaylist")
                )}
              </button>
            ) : result?.playlistCreated && result.playlist?.id ? (
              <Link
                href={`/playlists/${result.playlist.id}`}
                onClick={onClose}
                className="btn-primary touch-target-lg inline-flex items-center justify-center gap-2"
              >
                {tc("open")}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default function PlaylistsPage() {
  const t = useTranslations("playlists");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const { openMenu } = usePlaylistContextMenu();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isM3u8ImportDialogOpen, setIsM3u8ImportDialogOpen] = useState(false);
  const [m3u8ImportPayload, setM3u8ImportPayload] =
    useState<M3u8ImportPayload | null>(null);
  const [m3u8ImportResult, setM3u8ImportResult] =
    useState<ImportM3u8PlaylistResponse | null>(null);
  const [m3u8ImportError, setM3u8ImportError] = useState<string | null>(null);
  const [isReadingM3u8File, setIsReadingM3u8File] = useState(false);
  const m3u8FileInputRef = useRef<HTMLInputElement>(null);

  const { data: playlists, isLoading } = api.music.getPlaylists.useQuery(
    undefined,
    { enabled: !!session },
  );

  const utils = api.useUtils();
  const createPlaylist = api.music.createPlaylist.useMutation({
    onSuccess: async (playlist) => {
      await utils.music.getPlaylists.invalidate();
      if (playlist) {
        showToast(t("createdPlaylist", { name: playlist.name }), "success");
        setShowCreateModal(false);
        setNewPlaylistName("");
        setNewPlaylistDescription("");
        setIsPublic(false);
        router.push(`/playlists/${playlist.id}`);
      }
    },
    onError: (error) => {
      showToast(t("failedToCreate", { error: error.message }), "error");
    },
  });
  const importM3u8Playlist = api.music.importM3u8Playlist.useMutation({
    fetchImpl: authFetch,
    onSuccess: async (result, variables) => {
      setM3u8ImportError(null);
      setM3u8ImportResult(result);
      setIsM3u8ImportDialogOpen(true);

      if (result.playlistCreated) {
        await utils.music.getPlaylists.invalidate();
        const playlistName =
          result.playlist?.name ??
          variables.playlistName ??
          variables.sourcePlaylistName ??
          t("importM3u8");
        showToast(
          t("m3u8ImportCreatedToast", { name: playlistName }),
          "success",
        );
        hapticSuccess();
      }
    },
    onError: (error) => {
      const message = normalizeM3u8ImportError(error, t);
      setM3u8ImportError(message);
      setIsM3u8ImportDialogOpen(true);
      showToast(message, "error");
    },
  });

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      showToast(t("pleaseEnterName"), "error");
      return;
    }

    createPlaylist.mutate({
      name: newPlaylistName.trim(),
      description: newPlaylistDescription.trim() || undefined,
      isPublic,
    });
  };

  const handleM3u8File = async (file: File) => {
    if (!session?.user) {
      showToast(t("signInToCreate"), "error");
      return;
    }

    if (!isM3u8FileName(file.name)) {
      showToast(t("m3u8UnsupportedExtension"), "error");
      return;
    }

    setIsM3u8ImportDialogOpen(true);
    setM3u8ImportResult(null);
    setM3u8ImportError(null);
    setIsReadingM3u8File(true);

    try {
      const content = await file.text();
      const playlistName = getM3u8PlaylistName(file.name);
      const payload: M3u8ImportPayload = {
        content,
        sourcePlaylistId: file.name,
        sourcePlaylistName: playlistName,
        playlistName,
        createPlaylist: false,
        isPublic: false,
      };

      setM3u8ImportPayload(payload);
      importM3u8Playlist.mutate(payload);
    } catch (error) {
      const message = t("m3u8FileReadFailed", {
        error: error instanceof Error ? error.message : tc("unknownError"),
      });
      setM3u8ImportPayload(null);
      setM3u8ImportError(message);
      showToast(message, "error");
    } finally {
      setIsReadingM3u8File(false);
    }
  };

  const handleConfirmM3u8Import = () => {
    if (!m3u8ImportPayload || importM3u8Playlist.isPending) return;

    setM3u8ImportError(null);
    importM3u8Playlist.mutate({
      ...m3u8ImportPayload,
      createPlaylist: true,
    });
  };

  const handleCloseM3u8ImportDialog = () => {
    if (importM3u8Playlist.isPending) return;

    setIsM3u8ImportDialogOpen(false);
    setM3u8ImportPayload(null);
    setM3u8ImportResult(null);
    setM3u8ImportError(null);
    setIsReadingM3u8File(false);
    importM3u8Playlist.reset();
  };

  const handleM3u8FileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = "";

    if (!file) return;

    void handleM3u8File(file);
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-[var(--color-subtext)]">
            {t("signInPrompt")}
          </p>
          <Link href="/signin?callbackUrl=%2Fplaylists" className="btn-primary">
            {tc("signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen flex-col px-3 py-4 md:px-6 md:py-8">
      {}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text)] md:text-3xl">
          {t("yourPlaylists")}
        </h1>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              m3u8FileInputRef.current?.click();
            }}
            disabled={importM3u8Playlist.isPending}
            className="btn-secondary touch-target-lg flex w-full items-center justify-center gap-2 disabled:opacity-50 md:w-auto"
          >
            <Upload className="h-5 w-5" />
            <span>
              {importM3u8Playlist.isPending
                ? t("importingM3u8")
                : t("importM3u8")}
            </span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary touch-target-lg flex w-full items-center justify-center gap-2 md:w-auto"
          >
            <Plus className="h-5 w-5" />
            <span>{t("createPlaylist")}</span>
          </button>
        </div>
      </div>
      <input
        ref={m3u8FileInputRef}
        type="file"
        accept=".m3u,.m3u8,audio/mpegurl,audio/x-mpegurl,application/vnd.apple.mpegurl"
        className="sr-only"
        onChange={handleM3u8FileChange}
        aria-label={t("importM3u8")}
      />
      <M3u8ImportDialog
        isOpen={isM3u8ImportDialogOpen}
        isSubmitting={importM3u8Playlist.isPending}
        isReadingFile={isReadingM3u8File}
        payload={m3u8ImportPayload}
        result={m3u8ImportResult}
        error={m3u8ImportError}
        onClose={handleCloseM3u8ImportDialog}
        onConfirm={handleConfirmM3u8Import}
      />

      {}
      {isLoading ? (
        <LoadingState message={t("loadingPlaylists")} />
      ) : playlists && playlists.length > 0 ? (
        <div className="fade-in grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlists/${playlist.id}`}
              className="surface-panel touch-active group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-1"
              onContextMenu={(e) => {
                e.preventDefault();
                hapticLight();
                openMenu(playlist, e.clientX, e.clientY);
              }}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[linear-gradient(135deg,rgba(244,178,102,0.28),rgba(88,198,177,0.22))]">
                <PlaylistArtwork
                  name={playlist.name}
                  tracks={playlist.tracks}
                  coverImage={playlist.coverImage}
                  className="relative h-full w-full overflow-hidden rounded-xl bg-[var(--color-surface)]"
                  imageClassName="object-cover transition-transform group-hover:scale-105"
                  iconClassName="h-12 w-12 text-[var(--color-text)]/60 md:h-16 md:w-16"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                <div className="theme-card-overlay absolute inset-0 opacity-0 transition group-hover:opacity-100" />
              </div>
              <div className="p-3 md:p-4">
                <h3 className="mb-1 truncate text-base font-semibold text-[var(--color-text)] md:text-lg">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="mb-2 line-clamp-2 text-xs text-[var(--color-subtext)] md:text-sm">
                    {playlist.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>
                    {tc("tracks", { count: playlist.trackCount ?? 0 })}
                  </span>
                  <span
                    className={
                      playlist.isPublic
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-subtext)]"
                    }
                  >
                    • {playlist.isPublic ? tc("public") : tc("private")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Music className="h-12 w-12 md:h-16 md:w-16" />}
          title={t("noPlaylistsYet")}
          description={t("noPlaylistsDescription")}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  m3u8FileInputRef.current?.click();
                }}
                disabled={importM3u8Playlist.isPending}
                className="btn-secondary touch-target-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span>{t("importM3u8")}</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary touch-target-lg flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" />
                <span>{t("createYourFirst")}</span>
              </button>
            </div>
          }
        />
      )}

      {}
      {showCreateModal && (
        <>
          <div
            className="theme-chrome-backdrop fixed inset-0 z-50 backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false);
              setNewPlaylistName("");
              setNewPlaylistDescription("");
              setIsPublic(false);
            }}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 md:right-auto md:left-1/2 md:-translate-x-1/2">
            <div className="surface-panel slide-in-up w-full max-w-md p-4 md:p-6">
              <h2 className="mb-4 text-xl font-bold text-[var(--color-text)] md:text-2xl">
                {t("createPlaylist")}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="form-label">
                    {t("playlistNameRequired")}
                  </label>
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder={t("playlistNamePlaceholder")}
                    className="input-text"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("descriptionOptional")}
                  </label>
                  <textarea
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    rows={3}
                    className="input-text resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="touch-target h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
                  />
                  <label
                    htmlFor="isPublic"
                    className="text-sm text-[var(--color-subtext)]"
                  >
                    {t("makePublic")}
                  </label>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 md:flex-row md:gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName("");
                    setNewPlaylistDescription("");
                    setIsPublic(false);
                  }}
                  className="btn-secondary touch-target-lg flex-1"
                >
                  {tc("cancel")}
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={createPlaylist.isPending || !newPlaylistName.trim()}
                  className="btn-primary touch-target-lg flex-1"
                >
                  {createPlaylist.isPending ? t("creating") : tc("create")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
