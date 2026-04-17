// File: apps/web/src/app/playlists/page.tsx

"use client";

import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@starchild/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { usePlaylistContextMenu } from "@/contexts/PlaylistContextMenuContext";
import {
  parseM3u8Playlist,
  selectBestM3u8TrackMatch,
  type M3u8PlaylistEntry,
} from "@/utils/m3u8PlaylistImport";
import { api } from "@starchild/api-client/trpc/react";
import { getTrackById, searchTracks } from "@starchild/api-client/rest";
import { hapticLight } from "@/utils/haptics";
import type { Track } from "@starchild/types";
import { Music, Plus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

export const dynamic = "force-dynamic";

const M3U8_IMPORT_MAX_TRACKS = 500;

async function resolveM3u8Entry(
  entry: M3u8PlaylistEntry,
): Promise<Track | null> {
  if (entry.deezerTrackId !== null) {
    try {
      return await getTrackById(entry.deezerTrackId);
    } catch (error) {
      console.warn("[playlists] Failed to fetch Deezer track from M3U8 entry", {
        lineNumber: entry.lineNumber,
        error,
      });
    }
  }

  if (!entry.query) {
    return null;
  }

  try {
    const result = await searchTracks(entry.query);
    return selectBestM3u8TrackMatch(entry, result.data);
  } catch (error) {
    console.warn("[playlists] Failed to search M3U8 entry", {
      lineNumber: entry.lineNumber,
      query: entry.query,
      error,
    });
    return null;
  }
}

function getUniqueTracks(tracks: Track[]): Track[] {
  const seenTrackIds = new Set<number>();
  const uniqueTracks: Track[] = [];

  for (const track of tracks) {
    if (seenTrackIds.has(track.id)) continue;

    seenTrackIds.add(track.id);
    uniqueTracks.push(track);
  }

  return uniqueTracks;
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
  const [isImportingM3u8, setIsImportingM3u8] = useState(false);
  const [m3u8ImportStatus, setM3u8ImportStatus] = useState<string | null>(null);
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
  const createImportedPlaylist = api.music.createPlaylist.useMutation();
  const addImportedTrack = api.music.addToPlaylist.useMutation();

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

    setIsImportingM3u8(true);
    setM3u8ImportStatus(t("m3u8ReadingFile"));

    try {
      const content = await file.text();
      const parsed = parseM3u8Playlist(content, file.name);
      const entries = parsed.entries.slice(0, M3U8_IMPORT_MAX_TRACKS);

      if (parsed.entries.length > M3U8_IMPORT_MAX_TRACKS) {
        showToast(
          t("m3u8ImportLimitReached", {
            count: M3U8_IMPORT_MAX_TRACKS,
          }),
          "info",
        );
      }

      if (entries.length === 0) {
        showToast(t("m3u8NoEntries"), "error");
        return;
      }

      const resolvedTracks: Track[] = [];

      for (const [entryIndex, entry] of entries.entries()) {
        setM3u8ImportStatus(
          t("m3u8ResolvingTracks", {
            current: entryIndex + 1,
            total: entries.length,
          }),
        );

        const track = await resolveM3u8Entry(entry);
        if (track) {
          resolvedTracks.push(track);
        }
      }

      const uniqueTracks = getUniqueTracks(resolvedTracks);
      if (uniqueTracks.length === 0) {
        showToast(t("m3u8NoMatches"), "error");
        return;
      }

      setM3u8ImportStatus(t("creating"));
      const playlist = await createImportedPlaylist.mutateAsync({
        name: parsed.name,
        description: t("m3u8ImportDescription", { fileName: file.name }),
        isPublic: false,
      });

      let importedCount = 0;
      let failedCount = 0;

      for (const [trackIndex, track] of uniqueTracks.entries()) {
        setM3u8ImportStatus(
          t("m3u8AddingTracks", {
            current: trackIndex + 1,
            total: uniqueTracks.length,
          }),
        );

        try {
          await addImportedTrack.mutateAsync({
            playlistId: playlist.id,
            track,
          });
          importedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.warn("[playlists] Failed to add imported M3U8 track", {
            playlistId: playlist.id,
            trackId: track.id,
            error,
          });
        }
      }

      await utils.music.getPlaylists.invalidate();

      if (failedCount > 0) {
        showToast(
          t("importedM3u8PlaylistPartial", {
            name: playlist.name,
            imported: importedCount,
            total: uniqueTracks.length,
            failed: failedCount,
          }),
          "warning",
          5000,
        );
      } else {
        showToast(
          t("importedM3u8Playlist", {
            name: playlist.name,
            imported: importedCount,
            total: uniqueTracks.length,
          }),
          "success",
          5000,
        );
      }

      router.push(`/playlists/${playlist.id}`);
    } catch (error) {
      showToast(
        t("m3u8ImportFailed", {
          error: error instanceof Error ? error.message : tc("unknownError"),
        }),
        "error",
      );
    } finally {
      setIsImportingM3u8(false);
      setM3u8ImportStatus(null);
    }
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
            disabled={isImportingM3u8}
            className="btn-secondary touch-target-lg flex w-full items-center justify-center gap-2 disabled:opacity-50 md:w-auto"
          >
            <Upload className="h-5 w-5" />
            <span>
              {isImportingM3u8 ? t("importingM3u8") : t("importM3u8")}
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
      {m3u8ImportStatus && (
        <p
          className="mb-4 text-sm text-[var(--color-subtext)]"
          role="status"
          aria-live="polite"
        >
          {m3u8ImportStatus}
        </p>
      )}

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
                {playlist.tracks && playlist.tracks.length > 0 ? (
                  (() => {
                    const covers = playlist.tracks
                      .map((t) => t.track?.album?.cover_medium)
                      .filter((cover): cover is string => !!cover);

                    const uniqueCovers = Array.from(new Set(covers));

                    if (playlist.tracks.length < 4) {
                      return (
                        <div className="relative h-full w-full overflow-hidden rounded-xl bg-[var(--color-surface)]">
                          <Image
                            src={
                              playlist.tracks[0]?.track?.album?.cover_medium ??
                              "/placeholder.png"
                            }
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      );
                    }

                    if (playlist.tracks.length > 3 && uniqueCovers.length > 3) {
                      return (
                        <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
                          {playlist.tracks
                            .slice(0, 4)
                            .map((playlistTrack, idx) => (
                              <div
                                key={idx}
                                className="relative h-full w-full overflow-hidden rounded-[0.65rem] bg-[var(--color-surface)]"
                              >
                                <Image
                                  src={
                                    playlistTrack.track?.album?.cover_medium ??
                                    "/placeholder.png"
                                  }
                                  alt=""
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ))}
                        </div>
                      );
                    }

                    const coverFrequency = new Map<string, number>();
                    covers.forEach((cover) => {
                      coverFrequency.set(
                        cover,
                        (coverFrequency.get(cover) ?? 0) + 1,
                      );
                    });

                    let dominantCover = covers[0] ?? "/placeholder.png";
                    let maxFrequency = 0;
                    coverFrequency.forEach((frequency, cover) => {
                      if (frequency > maxFrequency) {
                        maxFrequency = frequency;
                        dominantCover = cover;
                      }
                    });

                    return (
                      <div className="relative h-full w-full overflow-hidden rounded-xl bg-[var(--color-surface)]">
                        <Image
                          src={dominantCover}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--color-text)]/60">
                    <Music className="h-12 w-12 md:h-16 md:w-16" />
                  </div>
                )}
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
                disabled={isImportingM3u8}
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
