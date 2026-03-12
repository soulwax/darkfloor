"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ListMusic,
  Loader2,
} from "lucide-react";

export type SpotifyImportPlaylistTarget = {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  trackCount: number | null;
  imageUrl: string | null;
};

export type SpotifyImportRequest = {
  spotifyPlaylistId: string;
  nameOverride?: string;
  isPublic?: boolean;
};

export type SpotifyImportUnmatchedReason =
  | "not_found"
  | "ambiguous"
  | "invalid"
  | "unsupported";

export type SpotifyImportResult = {
  ok: true;
  playlist: {
    id: number;
    name: string;
  };
  importReport: {
    sourcePlaylistId: string;
    sourcePlaylistName: string;
    totalTracks: number;
    matchedCount: number;
    unmatchedCount: number;
    skippedCount: number;
    unmatched: Array<{
      index: number;
      spotifyTrackId: string | null;
      name: string;
      artist: string | null;
      reason: SpotifyImportUnmatchedReason;
    }>;
  };
};

interface SpotifyImportDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  playlist: SpotifyImportPlaylistTarget | null;
  importError: string | null;
  importResult: SpotifyImportResult | null;
  onClose: () => void;
  onSubmit: (input: SpotifyImportRequest) => void;
}

function SpotifyImportCover(props: {
  imageUrl: string | null;
  alt: string;
}) {
  const { alt, imageUrl } = props;

  return (
    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-[var(--color-muted)]/20 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <ListMusic className="h-7 w-7 text-[var(--color-subtext)]" />
      )}
    </div>
  );
}

export function SpotifyImportDialog(props: SpotifyImportDialogProps) {
  const {
    importError,
    importResult,
    isOpen,
    isSubmitting,
    onClose,
    onSubmit,
    playlist,
  } = props;
  const t = useTranslations("spotify");
  const tc = useTranslations("common");
  const tp = useTranslations("playlists");
  const [playlistName, setPlaylistName] = useState(() => playlist?.name ?? "");
  const [isPublic, setIsPublic] = useState(false);

  const canSubmit = Boolean(
    playlist && playlistName.trim().length > 0 && !isSubmitting,
  );
  const unmatchedTracks = importResult?.importReport.unmatched ?? [];
  const sourceTrackCountLabel = useMemo(() => {
    if (!playlist) {
      return t("trackCountUnknown");
    }

    return typeof playlist.trackCount === "number"
      ? tc("tracks", { count: playlist.trackCount })
      : t("trackCountUnknown");
  }, [playlist, t, tc]);

  const handleSubmit = () => {
    if (!playlist || !playlistName.trim()) {
      return;
    }

    onSubmit({
      spotifyPlaylistId: playlist.id,
      nameOverride:
        playlistName.trim() !== playlist.name ? playlistName.trim() : undefined,
      isPublic,
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) {
          onClose();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-3xl rounded-[1.75rem] p-0">
        {playlist ? (
          <div className="overflow-hidden rounded-[1.75rem]">
            <DialogHeader className="border-b border-[var(--color-border)] px-6 py-5">
              <DialogTitle className="text-xl text-[var(--color-text)]">
                {importResult ? t("importSuccessTitle") : t("importToStarchild")}
              </DialogTitle>
              <DialogDescription className="mt-2 leading-6">
                {importResult
                  ? t("importSuccessDescription", {
                      name: importResult.playlist.name,
                    })
                  : t("importPlaylistDescription")}
              </DialogDescription>
            </DialogHeader>

            {!importResult ? (
              <>
                <div className="grid gap-6 px-6 py-6 md:grid-cols-[160px,minmax(0,1fr)]">
                  <SpotifyImportCover
                    imageUrl={playlist.imageUrl}
                    alt={playlist.name}
                  />

                  <div className="min-w-0">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-4">
                      <p className="truncate text-lg font-semibold text-[var(--color-text)]">
                        {playlist.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-subtext)]">
                        {t("byOwner", {
                          owner: playlist.ownerName ?? "Spotify",
                        })}
                        {" • "}
                        {sourceTrackCountLabel}
                      </p>
                      {playlist.description ? (
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--color-subtext)]">
                          {playlist.description}
                        </p>
                      ) : null}
                    </div>

                    {importError ? (
                      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-4 text-sm leading-6 text-red-200">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{importError}</p>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                          {tp("playlistNameRequired")}
                        </label>
                        <input
                          type="text"
                          value={playlistName}
                          onChange={(event) =>
                            setPlaylistName(event.target.value)
                          }
                          placeholder={tp("playlistNamePlaceholder")}
                          disabled={isSubmitting}
                          className="theme-input w-full rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] transition-all hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </div>

                      <label className="flex items-center gap-3 text-sm text-[var(--color-subtext)]">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(event) => setIsPublic(event.target.checked)}
                          disabled={isSubmitting}
                          className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
                        />
                        {tp("makePublic")}
                      </label>

                      <p className="text-xs leading-6 text-[var(--color-subtext)]">
                        {t("importReadyHint")}
                      </p>
                    </div>
                  </div>
                </div>

                <DialogFooter className="border-t border-[var(--color-border)] px-6 py-5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tc("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("importingToStarchild")}
                      </>
                    ) : (
                      t("importToStarchild")
                    )}
                  </button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-6 px-6 py-6">
                  <div className="flex items-start gap-3 rounded-2xl border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)] p-4">
                    <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1DB954]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {importResult.playlist.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--color-subtext)]">
                        {t("importCompletedToast", {
                          name: importResult.playlist.name,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                        {t("importMatchedCount", {
                          count: importResult.importReport.matchedCount,
                        })}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                        {importResult.importReport.matchedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                        {t("importUnmatchedCount", {
                          count: importResult.importReport.unmatchedCount,
                        })}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                        {importResult.importReport.unmatchedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                        {t("importSkippedCount", {
                          count: importResult.importReport.skippedCount,
                        })}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                        {importResult.importReport.skippedCount}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {t("unmatchedTracks")}
                    </p>
                    {unmatchedTracks.length === 0 ? (
                      <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                        {t("noUnmatchedTracks")}
                      </p>
                    ) : (
                      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                        {unmatchedTracks.map((track) => (
                          <div
                            key={`${track.index}-${track.spotifyTrackId ?? track.name}`}
                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                  {track.index + 1}. {track.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                  {track.artist ?? tc("unknownArtist")}
                                </p>
                              </div>
                              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--color-subtext)] uppercase">
                                {track.reason === "ambiguous"
                                  ? t("importReasonAmbiguous")
                                  : track.reason === "invalid"
                                    ? t("importReasonInvalid")
                                    : track.reason === "unsupported"
                                      ? t("importReasonUnsupported")
                                      : t("importReasonNotFound")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="border-t border-[var(--color-border)] px-6 py-5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]/80"
                  >
                    {tc("close")}
                  </button>
                  <Link
                    href={`/playlists/${importResult.playlist.id}`}
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    {t("openImportedPlaylist")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </DialogFooter>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
