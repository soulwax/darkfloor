"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ImportSpotifyPlaylistInput,
  ImportSpotifyPlaylistResponse,
} from "@starchild/api-client/trpc/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Disc3,
  ListMusic,
  Loader2,
  Sparkles,
} from "lucide-react";

export type SpotifyImportPlaylistTarget = {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  trackCount: number | null;
  imageUrl: string | null;
};

export type SpotifyImportRequest = ImportSpotifyPlaylistInput;
export type SpotifyImportResult = ImportSpotifyPlaylistResponse;
export type SpotifyImportDiagnostics = {
  status: number | null;
  errorCode: string | null;
  backendMessage: string | null;
  playlistId: string | null;
};

interface SpotifyImportDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  playlist: SpotifyImportPlaylistTarget | null;
  importError: string | null;
  importDiagnostics: SpotifyImportDiagnostics | null;
  importResult: SpotifyImportResult | null;
  onClose: () => void;
  onSubmit: (input: SpotifyImportRequest) => void;
}

function getReasonBadgeClasses(reason: string): string {
  switch (reason) {
    case "ambiguous":
      return "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-amber-200";
    case "invalid":
      return "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-red-200";
    case "unsupported":
      return "border-[rgba(129,140,248,0.35)] bg-[rgba(129,140,248,0.12)] text-indigo-200";
    default:
      return "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]";
  }
}

function SpotifyImportCover(props: {
  imageUrl: string | null;
  alt: string;
}) {
  const { alt, imageUrl } = props;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl =
    imageUrl && failedImageUrl !== imageUrl ? imageUrl : null;

  return (
    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-[var(--color-muted)]/20 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      {resolvedImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedImageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailedImageUrl(resolvedImageUrl)}
        />
      ) : (
        <ListMusic className="h-7 w-7 text-[var(--color-subtext)]" />
      )}
    </div>
  );
}

export function SpotifyImportDialog(props: SpotifyImportDialogProps) {
  const {
    importDiagnostics,
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
  const matchedRatio = useMemo(() => {
    if (!importResult || importResult.importReport.totalTracks <= 0) {
      return 0;
    }

    return Math.round(
      (importResult.importReport.matchedCount /
        importResult.importReport.totalTracks) *
        100,
    );
  }, [importResult]);
  const hasPartialImport = Boolean(
    importResult &&
      (importResult.importReport.unmatchedCount > 0 ||
        importResult.importReport.skippedCount > 0),
  );
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
      <DialogContent className="flex w-[calc(100%-1.5rem)] max-w-3xl flex-col rounded-[1.75rem] p-0">
        {playlist ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
            <DialogHeader className="shrink-0 border-b border-[var(--color-border)] px-6 py-5">
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
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("importStageSource")}
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ${
                    isSubmitting
                      ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[#1DB954]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
                  }`}
                >
                  <Disc3
                    className={`h-3.5 w-3.5 ${isSubmitting ? "animate-spin" : ""}`}
                  />
                  {t("importStageMatch")}
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ${
                    importResult
                      ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[#1DB954]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
                  }`}
                >
                  <CircleCheck className="h-3.5 w-3.5" />
                  {t("importStageResult")}
                </span>
              </div>
            </DialogHeader>

            {!importResult ? (
              <>
                <div className="min-h-0 overflow-y-auto">
                  <div className="relative overflow-hidden px-6 py-6">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(29,185,84,0.18),transparent_55%)]" />
                    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
                    <div className="space-y-4">
                      <div className="rounded-[1.75rem] border border-[rgba(29,185,84,0.18)] bg-[linear-gradient(145deg,rgba(29,185,84,0.16),rgba(15,23,42,0.84))] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <SpotifyImportCover
                            imageUrl={playlist.imageUrl}
                            alt={playlist.name}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                              {t("importSourceLabel")}
                            </span>
                            <p className="mt-3 truncate text-xl font-semibold text-[var(--color-text)]">
                              {playlist.name}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-subtext)]">
                              {t("byOwner", {
                                owner: playlist.ownerName ?? "Spotify",
                              })}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--color-text)]">
                                {sourceTrackCountLabel}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--color-text)]">
                                {isPublic ? tc("public") : tc("private")}
                              </span>
                            </div>
                          </div>
                        </div>
                        {playlist.description ? (
                          <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--color-subtext)]">
                            {playlist.description}
                          </p>
                        ) : null}
                      </div>

                      {isSubmitting ? (
                        <div className="rounded-[1.75rem] border border-[rgba(29,185,84,0.24)] bg-[linear-gradient(160deg,rgba(29,185,84,0.14),rgba(15,23,42,0.8))] p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(29,185,84,0.28)] bg-[rgba(29,185,84,0.14)]">
                              <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
                            </div>
                            <div>
                              <p className="text-base font-semibold text-[var(--color-text)]">
                                {t("importProgressTitle")}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[var(--color-subtext)]">
                                {t("importProgressDescription")}
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 space-y-3">
                            {[
                              t("importStageSource"),
                              t("importStageMatch"),
                              t("importStageResult"),
                            ].map((label, index) => (
                              <div
                                key={label}
                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium text-[var(--color-text)]">
                                    {label}
                                  </span>
                                  <Loader2
                                    className="h-4 w-4 animate-spin text-[#1DB954]"
                                    style={{
                                      animationDelay: `${index * 150}ms`,
                                    }}
                                  />
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                                  <div
                                    className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,rgba(29,185,84,0.28),#1DB954,rgba(29,185,84,0.28))] animate-pulse"
                                    style={{
                                      animationDelay: `${index * 180}ms`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      {importError ? (
                        <div className="flex items-start gap-3 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-4 text-sm leading-6 text-red-200">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>{importError}</p>
                        </div>
                      ) : null}

                      {importDiagnostics ? (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importDiagnosticsTitle")}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {importDiagnostics.status ? (
                              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 px-3 py-2">
                                <p className="text-[11px] tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                  {t("importDiagnosticsStatus")}
                                </p>
                                <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
                                  {importDiagnostics.status}
                                </p>
                              </div>
                            ) : null}
                            {importDiagnostics.errorCode ? (
                              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 px-3 py-2">
                                <p className="text-[11px] tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                  {t("importDiagnosticsCode")}
                                </p>
                                <p className="mt-1 truncate text-sm font-medium text-[var(--color-text)]">
                                  {importDiagnostics.errorCode}
                                </p>
                              </div>
                            ) : null}
                            {importDiagnostics.playlistId ? (
                              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 px-3 py-2 sm:col-span-2">
                                <p className="text-[11px] tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                  {t("importDiagnosticsPlaylistId")}
                                </p>
                                <p className="mt-1 truncate font-mono text-sm text-[var(--color-text)]">
                                  {importDiagnostics.playlistId}
                                </p>
                              </div>
                            ) : null}
                          </div>
                          {importDiagnostics.backendMessage ? (
                            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 px-3 py-2">
                              <p className="text-[11px] tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                {t("importDiagnosticsBackendMessage")}
                              </p>
                              <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/10 p-3">
                                <p className="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-[var(--color-text)]/90">
                                  {importDiagnostics.backendMessage}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importDestinationLabel")}
                          </span>
                        </div>

                        <div className="mt-5">
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

                        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 text-sm text-[var(--color-subtext)]">
                          <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(event) => setIsPublic(event.target.checked)}
                            disabled={isSubmitting}
                            className="h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
                          />
                          {tp("makePublic")}
                        </label>

                        <div className="mt-4 rounded-2xl border border-[rgba(29,185,84,0.2)] bg-[rgba(29,185,84,0.08)] p-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                            {t("playlistMigration")}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-subtext)]">
                            {t("importReadyHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="shrink-0 border-t border-[var(--color-border)] px-6 py-5">
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
                <div className="min-h-0 overflow-y-auto">
                  <div className="space-y-6 px-6 py-6">
                  <div className="relative overflow-hidden rounded-[1.75rem] border border-[rgba(29,185,84,0.3)] bg-[linear-gradient(155deg,rgba(29,185,84,0.18),rgba(15,23,42,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                    <div className="pointer-events-none absolute right-0 bottom-0 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(29,185,84,0.2),transparent_70%)]" />
                    <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)]">
                          <CircleCheck className="h-6 w-6 text-[#1DB954]" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[var(--color-text)]">
                            {importResult.playlist.name}
                          </p>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-subtext)]">
                            {t("importCompletedToast", {
                              importedCount: importResult.importReport.matchedCount,
                              totalCount: importResult.importReport.totalTracks,
                              name: importResult.playlist.name,
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importMatchedCount", {
                              count: importResult.importReport.matchedCount,
                            })}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                            {importResult.importReport.matchedCount}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importSkippedCount", {
                              count: importResult.importReport.skippedCount,
                            })}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                            {importResult.importReport.skippedCount}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importMatchRate")}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                            {matchedRatio}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45">
                    <div className="grid gap-0 md:grid-cols-[minmax(0,1fr),96px,minmax(0,1fr)]">
                      <div className="p-5">
                        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                          {t("importSourceLabel")}
                        </p>
                        <p className="mt-2 truncate text-lg font-semibold text-[var(--color-text)]">
                          {importResult.importReport.sourcePlaylistName}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-subtext)]">
                          {tc("tracks", {
                            count: importResult.importReport.totalTracks,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center justify-center border-y border-[var(--color-border)]/80 py-4 md:border-x md:border-y-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)]">
                          <ArrowRight className="h-5 w-5 text-[#1DB954]" />
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                          {t("importDestinationLabel")}
                        </p>
                        <p className="mt-2 truncate text-lg font-semibold text-[var(--color-text)]">
                          {importResult.playlist.name}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-subtext)]">
                          {t("importSuccessDescription", {
                            name: importResult.playlist.name,
                          })}
                        </p>
                      </div>
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

                  {hasPartialImport ? (
                    <div className="rounded-[1.5rem] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-4">
                      <div className="flex items-start gap-3">
                        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                        <div>
                          <p className="text-sm font-semibold text-amber-100">
                            {t("importPartialTitle")}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-amber-50/90">
                            {t("importPartialDescription", {
                              unmatchedCount:
                                importResult.importReport.unmatchedCount,
                              skippedCount:
                                importResult.importReport.skippedCount,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

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
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)]">
                                    {track.index + 1}
                                  </span>
                                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                    {track.name}
                                  </p>
                                </div>
                                <p className="mt-2 truncate text-xs text-[var(--color-subtext)]">
                                  {track.artist ?? tc("unknownArtist")}
                                </p>
                              </div>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase ${getReasonBadgeClasses(track.reason)}`}
                              >
                                {track.reason === "ambiguous"
                                  ? t("importReasonAmbiguous")
                                  : track.reason === "invalid"
                                    ? t("importReasonInvalid")
                                    : track.reason === "unsupported"
                                      ? t("importReasonUnsupported")
                                      : t("importReasonNotFound")}
                              </span>
                            </div>
                            {track.spotifyTrackId ? (
                              <p className="mt-3 text-[11px] font-mono text-[var(--color-subtext)]/90">
                                {track.spotifyTrackId}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <DialogFooter className="shrink-0 border-t border-[var(--color-border)] px-6 py-5">
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(29,185,84,0.22)] transition hover:brightness-110"
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
