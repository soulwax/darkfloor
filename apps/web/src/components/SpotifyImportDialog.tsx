// File: apps/web/src/components/SpotifyImportDialog.tsx

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchTracks } from "@starchild/api-client/rest";
import type {
  ImportSpotifyPlaylistInput,
  ImportSpotifyPlaylistResponse,
} from "@starchild/api-client/trpc/react";
import type { Track } from "@starchild/types";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  ListMusic,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";

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

type SpotifyImportUnmatchedTrack =
  SpotifyImportResult["importReport"]["unmatched"][number];
type SpotifyImportSourcePlaylist = NonNullable<
  SpotifyImportRequest["sourcePlaylist"]
>;
type SpotifyImportWizardStep = "review" | "destination" | "confirm";
type SpotifyImportResolvedOption = {
  deezerTrackId: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  score: number | null;
  link: string | null;
  coverImageUrl: string | null;
  source: "suggested" | "search";
};
type AlternativeSearchState = {
  query: string;
  isExpanded: boolean;
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  results: Track[];
};
type TrackSelectionState = {
  includeSelection: boolean;
  selectedDeezerTrackId: string | null;
};

interface SpotifyImportDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  playlist: SpotifyImportPlaylistTarget | null;
  importError: string | null;
  importDiagnostics: SpotifyImportDiagnostics | null;
  importResult: SpotifyImportResult | null;
  sourcePlaylistSnapshot?: SpotifyImportSourcePlaylist | null;
  onClose: () => void;
  onSubmit: (input: SpotifyImportRequest) => void;
}

const IMPORT_WIZARD_STEPS: Array<{
  id: SpotifyImportWizardStep;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    id: "review",
    titleKey: "importWizardStepReview",
    descriptionKey: "importWizardStepReviewDescription",
  },
  {
    id: "destination",
    titleKey: "importWizardStepDestination",
    descriptionKey: "importWizardStepDestinationDescription",
  },
  {
    id: "confirm",
    titleKey: "importWizardStepConfirm",
    descriptionKey: "importWizardStepConfirmDescription",
  },
];

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

function formatTrackDuration(durationSeconds: number | null): string | null {
  if (durationSeconds == null || durationSeconds < 0) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTrackKey(track: SpotifyImportUnmatchedTrack): string {
  return `${track.index}-${track.spotifyTrackId ?? track.name}`;
}

function buildAlternativeSearchQuery(track: SpotifyImportUnmatchedTrack): string {
  return [track.artist, track.name]
    .map((value) => value?.trim() ?? "")
    .filter(
      (value, index, values) =>
        value.length > 0 && values.indexOf(value) === index,
    )
    .join(" ");
}

function createAlternativeSearchState(
  track: SpotifyImportUnmatchedTrack,
): AlternativeSearchState {
  return {
    query: buildAlternativeSearchQuery(track),
    isExpanded: false,
    isLoading: false,
    hasSearched: false,
    error: null,
    results: [],
  };
}

function SpotifyImportCover(props: { imageUrl: string | null; alt: string }) {
  const { alt, imageUrl } = props;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl =
    imageUrl && failedImageUrl !== imageUrl ? imageUrl : null;

  return (
    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-[var(--color-muted)]/20 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
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

function DeezerCandidateCover(props: { imageUrl: string | null; alt: string }) {
  const { alt, imageUrl } = props;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl =
    imageUrl && failedImageUrl !== imageUrl ? imageUrl : null;

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-muted)]/20">
      {resolvedImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedImageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailedImageUrl(resolvedImageUrl)}
        />
      ) : (
        <ListMusic className="h-4 w-4 text-[var(--color-subtext)]" />
      )}
    </div>
  );
}

function toSearchResultOption(track: Track): SpotifyImportResolvedOption {
  return {
    deezerTrackId: String(track.id),
    title: track.title_short ?? track.title,
    artist: track.artist?.name ?? null,
    album: track.album?.title ?? null,
    durationSeconds: track.duration ?? null,
    score: null,
    link: track.link ?? null,
    coverImageUrl:
      track.album?.cover_medium ??
      track.album?.cover_small ??
      track.album?.cover ??
      null,
    source: "search",
  };
}

function buildTrackOptions(
  track: SpotifyImportUnmatchedTrack,
  searchResults: Track[],
): SpotifyImportResolvedOption[] {
  const options = new Map<string, SpotifyImportResolvedOption>();

  for (const candidate of track.candidates ?? []) {
    options.set(candidate.deezerTrackId, {
      ...candidate,
      source: "suggested",
    });
  }

  for (const result of searchResults) {
    const option = toSearchResultOption(result);
    if (!options.has(option.deezerTrackId)) {
      options.set(option.deezerTrackId, option);
    }
  }

  return Array.from(options.values());
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
    sourcePlaylistSnapshot,
  } = props;
  const t = useTranslations("spotify");
  const tc = useTranslations("common");
  const tp = useTranslations("playlists");

  const [playlistName, setPlaylistName] = useState(() => playlist?.name ?? "");
  const [isPublic, setIsPublic] = useState(false);
  const [activeWizardStep, setActiveWizardStep] =
    useState<SpotifyImportWizardStep>("review");
  const [expandedSuggestions, setExpandedSuggestions] = useState<
    Record<string, boolean>
  >({});
  const [alternativeSearchState, setAlternativeSearchState] = useState<
    Record<string, AlternativeSearchState>
  >({});
  const [trackSelections, setTrackSelections] = useState<
    Record<string, TrackSelectionState>
  >({});
  const resolvedDestinationPlaylistName =
    playlistName.trim().length > 0 ? playlistName.trim() : (playlist?.name ?? "");

  const unmatchedTracks = useMemo(
    () => importResult?.importReport.unmatched ?? [],
    [importResult],
  );
  const isReviewingMatches = Boolean(importResult && !importResult.playlistCreated);
  const hasPartialImport = Boolean(
    importResult &&
      (importResult.importReport.unmatchedCount > 0 ||
        importResult.importReport.skippedCount > 0),
  );
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
  const sourceTrackCountLabel = useMemo(() => {
    if (!playlist) {
      return t("trackCountUnknown");
    }

    return typeof playlist.trackCount === "number"
      ? tc("tracks", { count: playlist.trackCount })
      : t("trackCountUnknown");
  }, [playlist, t, tc]);
  const activeWizardStepIndex = useMemo(
    () =>
      IMPORT_WIZARD_STEPS.findIndex((step) => step.id === activeWizardStep),
    [activeWizardStep],
  );
  const canSubmit = Boolean(
    playlist && playlistName.trim().length > 0 && !isSubmitting,
  );
  const canAdvanceFromDestination =
    playlistName.trim().length > 0 && !isSubmitting;
  const canContinue =
    activeWizardStep === "review"
      ? true
      : activeWizardStep === "destination"
        ? canAdvanceFromDestination
        : canSubmit;
  const canFinalizeReview = Boolean(
    playlist &&
      sourcePlaylistSnapshot &&
      playlistName.trim().length > 0 &&
      !isSubmitting,
  );
  const selectedProposalCount = useMemo(
    () =>
      unmatchedTracks.reduce((count, track) => {
        const trackKey = getTrackKey(track);
        const options = buildTrackOptions(
          track,
          alternativeSearchState[trackKey]?.results ?? [],
        );
        const selection = trackSelections[trackKey];
        const selectedDeezerTrackId =
          selection?.selectedDeezerTrackId ?? options[0]?.deezerTrackId ?? null;
        const includeSelection =
          selection?.includeSelection ?? Boolean(selectedDeezerTrackId);

        return includeSelection && selectedDeezerTrackId ? count + 1 : count;
      }, 0),
    [alternativeSearchState, trackSelections, unmatchedTracks],
  );

  const goToWizardStep = (stepId: SpotifyImportWizardStep) => {
    const nextIndex = IMPORT_WIZARD_STEPS.findIndex((step) => step.id === stepId);
    if (nextIndex === -1 || nextIndex > activeWizardStepIndex) {
      return;
    }

    setActiveWizardStep(stepId);
  };

  const handleContinue = () => {
    if (activeWizardStep === "confirm") {
      if (!playlist || !playlistName.trim()) {
        return;
      }

      onSubmit({
        spotifyPlaylistId: playlist.id,
        nameOverride:
          playlistName.trim() !== playlist.name ? playlistName.trim() : undefined,
        isPublic,
        createLocalPlaylist: false,
      });
      return;
    }

    const nextStep = IMPORT_WIZARD_STEPS[activeWizardStepIndex + 1];
    if (nextStep) {
      setActiveWizardStep(nextStep.id);
    }
  };

  const handleBack = () => {
    if (activeWizardStepIndex <= 0) {
      return;
    }

    const previousStep = IMPORT_WIZARD_STEPS[activeWizardStepIndex - 1];
    if (previousStep) {
      setActiveWizardStep(previousStep.id);
    }
  };

  const updateAlternativeSearchState = (
    track: SpotifyImportUnmatchedTrack,
    updater: (current: AlternativeSearchState) => AlternativeSearchState,
  ) => {
    const trackKey = getTrackKey(track);
    setAlternativeSearchState((current) => ({
      ...current,
      [trackKey]: updater(current[trackKey] ?? createAlternativeSearchState(track)),
    }));
  };

  const updateTrackSelection = (
    track: SpotifyImportUnmatchedTrack,
    updater: (current: TrackSelectionState) => TrackSelectionState,
  ) => {
    const trackKey = getTrackKey(track);
    const options = buildTrackOptions(
      track,
      alternativeSearchState[trackKey]?.results ?? [],
    );
    setTrackSelections((current) => ({
      ...current,
      [trackKey]: updater(
        current[trackKey] ?? {
          includeSelection: Boolean(options[0]),
          selectedDeezerTrackId: options[0]?.deezerTrackId ?? null,
        },
      ),
    }));
  };

  const runAlternativeSearch = async (
    track: SpotifyImportUnmatchedTrack,
    queryOverride?: string,
  ) => {
    const trackKey = getTrackKey(track);
    const rawQuery =
      queryOverride ??
      alternativeSearchState[trackKey]?.query ??
      buildAlternativeSearchQuery(track);
    const query = rawQuery.trim();

    if (!query) {
      updateAlternativeSearchState(track, (current) => ({
        ...current,
        query,
        isLoading: false,
        hasSearched: true,
        error: t("importAlternativeSearchEmpty"),
        results: [],
      }));
      return;
    }

    updateAlternativeSearchState(track, (current) => ({
      ...current,
      query,
      isLoading: true,
      hasSearched: true,
      error: null,
    }));

    try {
      const response = await searchTracks(query, 0);
      const results = response.data.slice(0, 6);
      const firstResult = results[0];
      updateAlternativeSearchState(track, (current) => ({
        ...current,
        query,
        isLoading: false,
        error: null,
        results,
      }));

      if (firstResult) {
        updateTrackSelection(track, (current) =>
          current.selectedDeezerTrackId
            ? current
            : {
                includeSelection: true,
                selectedDeezerTrackId: String(firstResult.id),
              },
        );
      }
    } catch (error) {
      console.error("[SpotifyImportDialog] Failed to search alternatives:", error);
      updateAlternativeSearchState(track, (current) => ({
        ...current,
        query,
        isLoading: false,
        error: t("importAlternativeSearchFailed"),
        results: [],
      }));
    }
  };

  const toggleAlternativeSearch = (track: SpotifyImportUnmatchedTrack) => {
    const trackKey = getTrackKey(track);
    const currentState: AlternativeSearchState =
      alternativeSearchState[trackKey] ?? createAlternativeSearchState(track);
    const nextExpanded = !currentState.isExpanded;

    updateAlternativeSearchState(track, (current) => ({
      ...current,
      isExpanded: nextExpanded,
    }));

    if (nextExpanded && !currentState.hasSearched) {
      void runAlternativeSearch(track);
    }
  };

  const handleFinalizeImport = () => {
    if (!playlist || !sourcePlaylistSnapshot || !playlistName.trim()) {
      return;
    }

    const tracks: SpotifyImportSourcePlaylist["tracks"] =
      sourcePlaylistSnapshot.tracks.map((track) => ({
        ...track,
        manualDeezerTrackId: null,
      }));

    for (const unmatchedTrack of unmatchedTracks) {
      const trackKey = getTrackKey(unmatchedTrack);
      const options = buildTrackOptions(
        unmatchedTrack,
        alternativeSearchState[trackKey]?.results ?? [],
      );
      const selection = trackSelections[trackKey];
      const selectedDeezerTrackId =
        selection?.selectedDeezerTrackId ?? options[0]?.deezerTrackId ?? null;
      const includeSelection =
        selection?.includeSelection ?? Boolean(selectedDeezerTrackId);

      if (!includeSelection || !selectedDeezerTrackId) {
        continue;
      }

      const sourceTrack = tracks[unmatchedTrack.index];
      if (sourceTrack) {
        sourceTrack.manualDeezerTrackId = selectedDeezerTrackId;
      }
    }

    onSubmit({
      spotifyPlaylistId: playlist.id,
      nameOverride:
        playlistName.trim() !== playlist.name ? playlistName.trim() : undefined,
      isPublic,
      createLocalPlaylist: true,
      sourcePlaylist: {
        ...sourcePlaylistSnapshot,
        tracks,
      },
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
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1rem)] max-w-3xl flex-col rounded-[1.25rem] p-0 sm:w-[calc(100%-1.5rem)]">
        {playlist ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
            <DialogHeader className="shrink-0 border-b border-[var(--color-border)] px-6 py-5">
              <DialogTitle className="text-xl text-[var(--color-text)]">
                {isReviewingMatches
                  ? t("importReviewTitle")
                  : importResult
                    ? t("importSuccessTitle")
                    : t("importToStarchild")}
              </DialogTitle>
              <DialogDescription className="mt-2 leading-6">
                {isReviewingMatches
                  ? t("importReviewDescription", {
                      unmatchedCount: importResult?.importReport.unmatchedCount ?? 0,
                    })
                  : importResult
                    ? t("importSuccessDescription", {
                        name: importResult.playlist?.name ?? playlistName.trim(),
                      })
                    : t("importPlaylistDescription")}
              </DialogDescription>
              {!importResult ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {IMPORT_WIZARD_STEPS.map((step, index) => {
                    const isCurrent = step.id === activeWizardStep;
                    const isComplete = index < activeWizardStepIndex;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => goToWizardStep(step.id)}
                        disabled={!isComplete}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          isCurrent
                            ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[var(--color-text)]"
                            : isComplete
                              ? "border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 text-[var(--color-text)] hover:border-[rgba(29,185,84,0.22)]"
                              : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 text-[var(--color-subtext)]"
                        } ${!isComplete ? "cursor-default" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                              isCurrent || isComplete
                                ? "bg-[#1DB954] text-white"
                                : "bg-white/8 text-[var(--color-subtext)]"
                            }`}
                          >
                            {isComplete ? (
                              <CircleCheck className="h-3.5 w-3.5" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="text-xs font-semibold tracking-[0.14em] uppercase">
                            {t(step.titleKey)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[var(--color-subtext)]">
                          {t(step.descriptionKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    t("importStageSource"),
                    t("importStageMatch"),
                    isReviewingMatches
                      ? t("importStageReview")
                      : t("importStageResult"),
                  ].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </DialogHeader>

            {!importResult ? (
              <>
                <div className="min-h-0 overflow-y-auto px-6 py-6">
                  {isSubmitting ? (
                    <div className="mx-auto max-w-2xl rounded-[1.25rem] border border-[rgba(29,185,84,0.24)] bg-[linear-gradient(160deg,rgba(29,185,84,0.14),rgba(15,23,42,0.8))] p-5 sm:p-6">
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
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
                      <div className="space-y-4">
                        {activeWizardStep === "review" ? (
                          <>
                            <div className="rounded-[1.25rem] border border-[rgba(29,185,84,0.18)] bg-[linear-gradient(145deg,rgba(29,185,84,0.16),rgba(15,23,42,0.84))] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
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
                                      {t("importWizardSpotifySource")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p className="mt-4 text-sm leading-6 text-[var(--color-subtext)]">
                                {playlist.description ??
                                  t("importWizardReviewFallbackDescription")}
                              </p>
                            </div>

                            <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-5">
                              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                {t("importWizardWhatHappensTitle")}
                              </p>
                              <div className="mt-4 space-y-3">
                                {[
                                  {
                                    title: t("importWizardWhatHappensKeepOrderTitle"),
                                    body: t("importWizardWhatHappensKeepOrderBody"),
                                  },
                                  {
                                    title: t("importWizardWhatHappensMatchTitle"),
                                    body: t("importWizardWhatHappensMatchBody"),
                                  },
                                  {
                                    title: t("importWizardWhatHappensReviewTitle"),
                                    body: t("importWizardWhatHappensReviewBody"),
                                  },
                                ].map((item) => (
                                  <div
                                    key={item.title}
                                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4"
                                  >
                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                      {item.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-[var(--color-subtext)]">
                                      {item.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : activeWizardStep === "destination" ? (
                          <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-5">
                            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                              {tp("playlistNameRequired")}
                            </label>
                            <input
                              type="text"
                              value={playlistName}
                              onChange={(event) =>
                                setPlaylistName(event.target.value)
                              }
                              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[rgba(29,185,84,0.45)] focus:ring-2 focus:ring-[rgba(29,185,84,0.2)]"
                            />
                            <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                              {t("importWizardDestinationHint")}
                            </p>

                            <label className="mt-5 flex items-center gap-3 text-sm text-[var(--color-text)]">
                              <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(event) =>
                                  setIsPublic(event.target.checked)
                                }
                                className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent"
                              />
                              <span>{tp("makePublic")}</span>
                            </label>
                          </div>
                        ) : (
                          <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-5">
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {t("importWizardConfirmTitle")}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--color-subtext)]">
                              {t("importWizardReadyBody")}
                            </p>
                            <div className="mt-4 space-y-3">
                              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
                                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                  {t("importSourceLabel")}
                                </p>
                                <p className="mt-2 text-sm font-medium text-[var(--color-text)]">
                                  {playlist.name}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
                                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                  {t("importDestinationLabel")}
                                </p>
                                <p className="mt-2 text-sm font-medium text-[var(--color-text)]">
                                  {playlistName.trim()}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
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
                            <div className="mt-3 space-y-2 text-sm text-[var(--color-subtext)]">
                              {importDiagnostics.status ? (
                                <p>{t("importDiagnosticsStatus")}: {importDiagnostics.status}</p>
                              ) : null}
                              {importDiagnostics.errorCode ? (
                                <p>{t("importDiagnosticsCode")}: {importDiagnostics.errorCode}</p>
                              ) : null}
                              {importDiagnostics.playlistId ? (
                                <p>{t("importDiagnosticsPlaylistId")}: {importDiagnostics.playlistId}</p>
                              ) : null}
                              {importDiagnostics.backendMessage ? (
                                <p>{t("importDiagnosticsBackendMessage")}: {importDiagnostics.backendMessage}</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 p-5">
                          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                            {t("importWizardSidebarTitle")}
                          </p>
                          <div className="mt-4 space-y-3">
                            {[
                              {
                                title: t("importWizardSidebarReviewTitle"),
                                body: t("importWizardSidebarReviewBody"),
                              },
                              {
                                title: t("importWizardSidebarNameTitle"),
                                body: t("importWizardSidebarNameBody"),
                              },
                              {
                                title: t("importWizardSidebarResultTitle"),
                                body: t("importWizardSidebarResultBody"),
                              },
                            ].map((item) => (
                              <div
                                key={item.title}
                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4"
                              >
                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-[var(--color-subtext)]">
                                  {item.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                  <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {activeWizardStep !== "review" ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]/80 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("importWizardBack")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={!canContinue}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {activeWizardStep === "confirm" ? (
                        isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("importingToStarchild")}
                          </>
                        ) : (
                          t("importToStarchild")
                        )
                      ) : (
                        <>
                          {t("importWizardContinue")}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="min-h-0 overflow-y-auto px-6 py-6">
                  {isReviewingMatches ? (
                    <div className="space-y-6">
                      <div className="rounded-[1.25rem] border border-[rgba(245,158,11,0.3)] bg-[linear-gradient(155deg,rgba(245,158,11,0.18),rgba(15,23,42,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.14)]">
                              <CircleAlert className="h-6 w-6 text-amber-200" />
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-[var(--color-text)]">
                                {resolvedDestinationPlaylistName}
                              </p>
                              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-subtext)]">
                                {t("importReviewSummary", {
                                  selectedCount: selectedProposalCount,
                                  unmatchedCount:
                                    importResult.importReport.unmatchedCount,
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
                                {t("importUnmatchedCount", {
                                  count: importResult.importReport.unmatchedCount,
                                })}
                              </p>
                              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                                {importResult.importReport.unmatchedCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                              <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                                {t("importSelectedCount")}
                              </p>
                              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                                {selectedProposalCount}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {t("importReviewChecklistTitle")}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-subtext)]">
                              {t("importReviewChecklistBody")}
                            </p>
                          </div>
                          <span className="rounded-full border border-[rgba(29,185,84,0.24)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[#9ff3bd] uppercase">
                            {t("importSelectedCountBadge", {
                              count: selectedProposalCount,
                            })}
                          </span>
                        </div>

                        <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                          {unmatchedTracks.map((track) => {
                            const trackKey = getTrackKey(track);
                            const searchState =
                              alternativeSearchState[trackKey] ??
                              createAlternativeSearchState(track);
                            const options = buildTrackOptions(
                              track,
                              searchState.results,
                            );
                            const selection = trackSelections[trackKey] ?? {
                              includeSelection: Boolean(options[0]),
                              selectedDeezerTrackId:
                                options[0]?.deezerTrackId ?? null,
                            };
                            const hasSuggestions = (track.candidates?.length ?? 0) > 0;
                            const suggestionsExpanded =
                              expandedSuggestions[trackKey] ?? false;

                            return (
                              <div
                                key={trackKey}
                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)]">
                                        {track.index + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                          {track.name}
                                        </p>
                                        <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                          {track.artist ?? tc("unknownArtist")}
                                        </p>
                                      </div>
                                    </div>
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

                                {hasSuggestions ? (
                                  <div className="mt-4 rounded-2xl border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.05)] p-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSuggestions((current) => ({
                                          ...current,
                                          [trackKey]: !current[trackKey],
                                        }))
                                      }
                                      aria-expanded={suggestionsExpanded}
                                      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition hover:text-[var(--color-text)]"
                                    >
                                      <div>
                                        <p className="text-xs font-semibold tracking-[0.14em] text-amber-100 uppercase">
                                          {t("importAmbiguousCandidatesTitle")}
                                        </p>
                                        <p className="mt-1 text-sm text-[var(--color-subtext)]">
                                          {suggestionsExpanded
                                            ? t("importAmbiguousCandidatesHide", {
                                                count: track.candidates?.length ?? 0,
                                              })
                                            : t("importAmbiguousCandidatesShow", {
                                                count: track.candidates?.length ?? 0,
                                              })}
                                        </p>
                                      </div>
                                      {suggestionsExpanded ? (
                                        <ChevronUp className="h-4 w-4 shrink-0 text-amber-200" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-amber-200" />
                                      )}
                                    </button>

                                    {suggestionsExpanded ? (
                                      <div className="mt-3 space-y-2">
                                        {track.candidates?.map((candidate) => (
                                          <div
                                            key={`${trackKey}-${candidate.deezerTrackId}`}
                                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3 py-2"
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                                  {candidate.title}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                                  {candidate.artist ?? tc("unknownArtist")}
                                                </p>
                                              </div>
                                              {typeof candidate.score === "number" ? (
                                                <span className="rounded-full border border-[rgba(29,185,84,0.24)] bg-[rgba(29,185,84,0.12)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#9ff3bd] uppercase">
                                                  {t("importCandidateMatchScore", {
                                                    score: Math.round(candidate.score),
                                                  })}
                                                </span>
                                              ) : null}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {options.length > 0 ? (
                                  <div className="mt-4 space-y-3">
                                    <label className="flex items-center gap-3 rounded-xl border border-[rgba(29,185,84,0.18)] bg-[rgba(29,185,84,0.08)] px-3 py-2 text-sm text-[var(--color-text)]">
                                      <input
                                        type="checkbox"
                                        checked={selection.includeSelection}
                                        onChange={(event) =>
                                          updateTrackSelection(track, (current) => ({
                                            ...current,
                                            includeSelection: event.target.checked,
                                          }))
                                        }
                                        className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent"
                                      />
                                      <span>{t("importUseSelectedMatch")}</span>
                                    </label>

                                    <div className="space-y-2">
                                      {options.map((option, index) => {
                                        const isSelected =
                                          selection.selectedDeezerTrackId ===
                                          option.deezerTrackId;

                                        return (
                                          <label
                                            key={`${trackKey}-${option.deezerTrackId}`}
                                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                                              isSelected
                                                ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)]"
                                                : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/45"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`spotify-import-${trackKey}`}
                                              checked={isSelected}
                                              onChange={() =>
                                                updateTrackSelection(track, () => ({
                                                  includeSelection: true,
                                                  selectedDeezerTrackId:
                                                    option.deezerTrackId,
                                                }))
                                              }
                                              className="mt-1 h-4 w-4 border-[var(--color-border)] bg-transparent"
                                            />
                                            <DeezerCandidateCover
                                              imageUrl={option.coverImageUrl}
                                              alt={option.title}
                                            />
                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                                    {option.title}
                                                  </p>
                                                  <p className="mt-1 truncate text-xs text-[var(--color-subtext)]">
                                                    {option.artist ?? tc("unknownArtist")}
                                                  </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                  {index === 0 ? (
                                                    <span className="rounded-full border border-[rgba(29,185,84,0.24)] bg-[rgba(29,185,84,0.12)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#9ff3bd] uppercase">
                                                      {t("importDefaultChoice")}
                                                    </span>
                                                  ) : null}
                                                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--color-subtext)] uppercase">
                                                    {option.source === "search"
                                                      ? t("importSearchResultBadge")
                                                      : t("importSuggestionBadge")}
                                                  </span>
                                                  {typeof option.score === "number" ? (
                                                    <span className="rounded-full border border-[rgba(29,185,84,0.24)] bg-[rgba(29,185,84,0.12)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#9ff3bd] uppercase">
                                                      {t("importCandidateMatchScore", {
                                                        score: Math.round(option.score),
                                                      })}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-subtext)]">
                                                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-2.5 py-1">
                                                  {option.album ?? tc("unknownAlbum")}
                                                </span>
                                                {formatTrackDuration(
                                                  option.durationSeconds,
                                                ) ? (
                                                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-2.5 py-1">
                                                    {formatTrackDuration(
                                                      option.durationSeconds,
                                                    )}
                                                  </span>
                                                ) : null}
                                              </div>
                                              <div className="mt-3 flex flex-wrap gap-3">
                                                {option.link ? (
                                                  <a
                                                    href={option.link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9ff3bd] transition hover:text-[#c8f9d9]"
                                                  >
                                                    {t("openTrackOnDeezer", {
                                                      title: option.title,
                                                    })}
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                  </a>
                                                ) : null}
                                                <Link
                                                  href={`/track/${option.deezerTrackId}`}
                                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-100 transition hover:text-white"
                                                >
                                                  {t("openTrackInStarchild", {
                                                    title: option.title,
                                                  })}
                                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                                </Link>
                                              </div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-4 text-sm text-[var(--color-subtext)]">
                                    {t("importNoSuggestedMatch")}
                                  </p>
                                )}

                                <div className="mt-4 rounded-2xl border border-[rgba(96,165,250,0.18)] bg-[rgba(59,130,246,0.06)] p-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleAlternativeSearch(track)}
                                    aria-expanded={searchState.isExpanded}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition hover:text-[var(--color-text)]"
                                  >
                                    <div>
                                      <p className="text-xs font-semibold tracking-[0.14em] text-sky-100 uppercase">
                                        {t("importAlternativeSearchTitle")}
                                      </p>
                                      <p className="mt-1 text-sm text-[var(--color-subtext)]">
                                        {searchState.isExpanded
                                          ? t("importAlternativeSearchHide")
                                          : t("importAlternativeSearchShow")}
                                      </p>
                                    </div>
                                    {searchState.isExpanded ? (
                                      <ChevronUp className="h-4 w-4 shrink-0 text-sky-200" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 shrink-0 text-sky-200" />
                                    )}
                                  </button>

                                  {searchState.isExpanded ? (
                                    <div className="mt-3 space-y-3">
                                      <div className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                          type="text"
                                          value={searchState.query}
                                          onChange={(event) =>
                                            updateAlternativeSearchState(
                                              track,
                                              (current) => ({
                                                ...current,
                                                query: event.target.value,
                                              }),
                                            )
                                          }
                                          placeholder={t(
                                            "importAlternativeSearchPlaceholder",
                                          )}
                                          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[rgba(59,130,246,0.45)] focus:ring-2 focus:ring-[rgba(59,130,246,0.22)]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void runAlternativeSearch(track)}
                                          disabled={searchState.isLoading}
                                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.15)] px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-[rgba(59,130,246,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {searchState.isLoading ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                              {t("importAlternativeSearchSearching")}
                                            </>
                                          ) : (
                                            <>
                                              <Search className="h-4 w-4" />
                                              {t("importAlternativeSearchAction")}
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      <p className="text-xs leading-5 text-[var(--color-subtext)]">
                                        {t("importAlternativeSearchHint")}
                                      </p>

                                      {searchState.error ? (
                                        <div className="rounded-xl border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm text-red-200">
                                          {searchState.error}
                                        </div>
                                      ) : null}

                                      {searchState.hasSearched ? (
                                        searchState.results.length > 0 ? (
                                          <p className="text-xs font-semibold tracking-[0.14em] text-sky-100 uppercase">
                                            {t("importAlternativeSearchResultsTitle", {
                                              count: searchState.results.length,
                                            })}
                                          </p>
                                        ) : (
                                          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3 py-2 text-sm text-[var(--color-subtext)]">
                                            {t("importAlternativeSearchNoResults")}
                                          </div>
                                        )
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-[1.25rem] border border-[rgba(29,185,84,0.3)] bg-[linear-gradient(155deg,rgba(29,185,84,0.18),rgba(15,23,42,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)]">
                              <CircleCheck className="h-6 w-6 text-[#1DB954]" />
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-[var(--color-text)]">
                                {importResult.playlist?.name}
                              </p>
                              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-subtext)]">
                                {t("importCompletedToast", {
                                  importedCount: importResult.importReport.matchedCount,
                                  totalCount: importResult.importReport.totalTracks,
                                  name:
                                    importResult.playlist?.name ?? playlistName.trim(),
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

                      {hasPartialImport ? (
                        <div className="rounded-[1.1rem] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-4">
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
                    </div>
                  )}
                </div>

                <DialogFooter className="shrink-0 border-t border-[var(--color-border)] px-6 py-5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]/80"
                  >
                    {isReviewingMatches ? tc("cancel") : tc("close")}
                  </button>
                  {isReviewingMatches ? (
                    <button
                      type="button"
                      onClick={handleFinalizeImport}
                      disabled={!canFinalizeReview}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(29,185,84,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("importingToStarchild")}
                        </>
                      ) : (
                        t("importCreateWithSelections")
                      )}
                    </button>
                  ) : importResult.playlist ? (
                    <Link
                      href={`/playlists/${importResult.playlist.id}`}
                      onClick={onClose}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(29,185,84,0.22)] transition hover:brightness-110"
                    >
                      {t("openImportedPlaylist")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </DialogFooter>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
