"use client";

import {
  SpotifyImportDialog,
  type SpotifyImportDiagnostics,
  type SpotifyImportPlaylistTarget,
  type SpotifyImportRequest,
  type SpotifyImportResult,
} from "@/components/SpotifyImportDialog";
import { useToast } from "@/contexts/ToastContext";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import { getSpotifyImportErrorMessageKey } from "@/utils/spotifyImportErrors";
import {
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  maskSpotifyClientId,
} from "@/utils/spotifyFeatureSettings";
import { authFetch } from "@/services/spotifyAuthClient";
import {
  api,
  ImportSpotifyPlaylistError,
} from "@starchild/api-client/trpc/react";
import { springPresets } from "@/utils/spring-animations";
import {
  ArrowRightLeft,
  CircleAlert,
  CircleCheck,
  Disc3,
  ExternalLink,
  KeyRound,
  ListMusic,
  Loader2,
  RefreshCcw,
  User2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type SpotifyPlaylistRouteResponse = {
  ok: boolean;
  payload?: unknown;
  error?: string;
};

type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  trackCount: number | null;
  imageUrl: string | null;
  externalUrl: string | null;
};

type SpotifyTrackSummary = {
  id: string | null;
  name: string;
  artists: string[];
  albumName: string | null;
  durationMs: number | null;
  externalUrl: string | null;
};

function getStatusClasses(
  state: ReturnType<typeof getSpotifyFeatureConnectionSummary>["state"],
): string {
  switch (state) {
    case "ready":
      return "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[#1DB954]";
    case "unavailable":
      return "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-red-300";
    case "incomplete":
      return "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-amber-300";
    default:
      return "border-(--color-border) bg-(--color-surface-hover) text-(--color-subtext)";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readFirstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function readFirstNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function extractFirstImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    const record = asRecord(entry);
    if (!record) continue;

    const url = readFirstString(record, ["url", "src"]);
    if (url) return url;
  }

  return null;
}

function extractArrayCandidates(
  payload: unknown,
  keys: string[],
): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload as unknown[];
  }

  const record = asRecord(payload);
  if (!record) return null;

  for (const key of keys) {
    const directValue = record[key];
    if (Array.isArray(directValue)) {
      return directValue as unknown[];
    }

    const nestedRecord = asRecord(directValue);
    if (!nestedRecord) continue;

    for (const nestedKey of ["items", "data", "playlists", "tracks"]) {
      const nestedValue = nestedRecord[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue as unknown[];
      }
    }
  }

  return null;
}

function extractSpotifyPlaylistSummary(
  value: unknown,
): SpotifyPlaylistSummary | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = readFirstString(record, ["id", "playlistId"]);
  const name = readFirstString(record, ["name", "title"]);
  if (!id || !name) return null;

  const owner = asRecord(record.owner);
  const tracks = asRecord(record.tracks);
  const externalUrls = asRecord(record.external_urls);

  return {
    id,
    name,
    description: readFirstString(record, ["description"]),
    ownerName: readFirstString(owner ?? {}, ["display_name", "name", "id"]),
    trackCount:
      readFirstNumber(tracks ?? {}, ["total"]) ??
      readFirstNumber(record, ["trackCount"]),
    imageUrl:
      extractFirstImageUrl(record.images) ??
      readFirstString(record, ["image", "imageUrl"]),
    externalUrl:
      readFirstString(externalUrls ?? {}, ["spotify"]) ??
      readFirstString(record, ["href", "uri", "link"]),
  };
}

function extractSpotifyPlaylistSummaries(
  payload: unknown,
): SpotifyPlaylistSummary[] {
  const entries =
    extractArrayCandidates(payload, ["items", "playlists", "data"]) ?? [];

  return entries
    .map((entry) => extractSpotifyPlaylistSummary(entry))
    .filter((value): value is SpotifyPlaylistSummary => value !== null);
}

function extractSpotifyPlaylistTracks(payload: unknown): SpotifyTrackSummary[] {
  const root = asRecord(payload);
  const tracksRecord = asRecord(root?.tracks);
  const entries =
    (Array.isArray(tracksRecord?.items) ? tracksRecord.items : null) ??
    extractArrayCandidates(payload, ["items", "tracks", "data"]) ??
    [];

  return entries
    .map((entry): SpotifyTrackSummary | null => {
      const record = asRecord(entry);
      if (!record) return null;

      const trackRecord = asRecord(record.track) ?? record;
      const name = readFirstString(trackRecord, ["name", "title"]);
      if (!name) return null;

      const artistsValue = trackRecord.artists;
      const artists = Array.isArray(artistsValue)
        ? artistsValue
            .map((artist) => {
              const artistRecord = asRecord(artist);
              return artistRecord
                ? readFirstString(artistRecord, ["name"])
                : null;
            })
            .filter((value): value is string => value !== null)
        : [];
      const album = asRecord(trackRecord.album);
      const externalUrls = asRecord(trackRecord.external_urls);

      return {
        id: readFirstString(trackRecord, ["id", "trackId"]),
        name,
        artists,
        albumName: readFirstString(album ?? {}, ["name", "title"]),
        durationMs: readFirstNumber(trackRecord, ["duration_ms", "durationMs"]),
        externalUrl: readFirstString(externalUrls ?? {}, ["spotify"]),
      };
    })
    .filter((value): value is SpotifyTrackSummary => value !== null);
}

function toSpotifyImportPlaylistTarget(
  playlist: SpotifyPlaylistSummary,
): SpotifyImportPlaylistTarget {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    ownerName: playlist.ownerName,
    trackCount: playlist.trackCount,
    imageUrl: playlist.imageUrl,
  };
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) return "";

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PlaylistCover(props: {
  imageUrl: string | null;
  alt: string;
  className: string;
  iconClassName?: string;
}) {
  const { alt, className, iconClassName = "h-5 w-5", imageUrl } = props;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const resolvedImageUrl =
    imageUrl && failedImageUrl !== imageUrl ? imageUrl : null;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-(--color-muted)/20 ${className}`}
    >
      {resolvedImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedImageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailedImageUrl(resolvedImageUrl)}
        />
      ) : (
        <ListMusic className={`${iconClassName} text-(--color-subtext)`} />
      )}
    </div>
  );
}

export default function SpotifyPage() {
  const t = useTranslations("spotify");
  const ts = useTranslations("settingsSpotify");
  const tc = useTranslations("common");
  const th = useTranslations("home");
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const utils = api.useUtils();
  const { data: preferences, isLoading } =
    api.music.getUserPreferences.useQuery(undefined, { enabled: !!session });

  const serverSettings = useMemo(
    () => extractSpotifyFeatureSettingsFromPreferences(preferences),
    [preferences],
  );
  const summary = useMemo(
    () =>
      getSpotifyFeatureConnectionSummary({
        settings: serverSettings,
      }),
    [serverSettings],
  );
  const [playlistsPayload, setPlaylistsPayload] = useState<unknown>(null);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [isPlaylistsLoading, setIsPlaylistsLoading] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );
  const [selectedPlaylistPayload, setSelectedPlaylistPayload] =
    useState<unknown>(null);
  const [selectedPlaylistError, setSelectedPlaylistError] = useState<
    string | null
  >(null);
  const [isSelectedPlaylistLoading, setIsSelectedPlaylistLoading] =
    useState(false);
  const [importPlaylist, setImportPlaylist] =
    useState<SpotifyImportPlaylistTarget | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDiagnostics, setImportDiagnostics] =
    useState<SpotifyImportDiagnostics | null>(null);
  const [importResult, setImportResult] = useState<SpotifyImportResult | null>(
    null,
  );
  const [isPreparingImportPayload, setIsPreparingImportPayload] =
    useState(false);

  const canLoadPublicPlaylists = summary.state === "ready";
  const spotifyPlaylists = useMemo(
    () => extractSpotifyPlaylistSummaries(playlistsPayload),
    [playlistsPayload],
  );
  const selectedPlaylistFromList = useMemo(
    () =>
      selectedPlaylistId
        ? spotifyPlaylists.find(
            (playlist) => playlist.id === selectedPlaylistId,
          )
        : null,
    [selectedPlaylistId, spotifyPlaylists],
  );
  const selectedPlaylistDetail = useMemo(
    () => extractSpotifyPlaylistSummary(selectedPlaylistPayload),
    [selectedPlaylistPayload],
  );
  const selectedPlaylistImageUrl =
    selectedPlaylistDetail?.imageUrl ??
    selectedPlaylistFromList?.imageUrl ??
    null;
  const selectedPlaylistTracks = useMemo(
    () => extractSpotifyPlaylistTracks(selectedPlaylistPayload),
    [selectedPlaylistPayload],
  );
  const selectedPlaylistTrackCount =
    selectedPlaylistDetail?.trackCount ??
    selectedPlaylistFromList?.trackCount ??
    (selectedPlaylistTracks.length > 0 ? selectedPlaylistTracks.length : null);
  const selectedPlaylistOwner =
    selectedPlaylistDetail?.ownerName ??
    selectedPlaylistFromList?.ownerName ??
    "Spotify";
  const connectionStateLabel =
    summary.state === "ready"
      ? tc("ready")
      : summary.state === "incomplete"
        ? tc("incomplete")
        : tc("inactive");
  const selectedImportTarget =
    useMemo<SpotifyImportPlaylistTarget | null>(() => {
      const source = selectedPlaylistDetail ?? selectedPlaylistFromList;
      return source ? toSpotifyImportPlaylistTarget(source) : null;
    }, [selectedPlaylistDetail, selectedPlaylistFromList]);
  const normalizeSpotifyError = useCallback(
    (message: string | null): string | null => {
      if (!message) return null;

      const normalized = message.toLowerCase();
      if (normalized.includes("settings are incomplete")) {
        return t("settingsIncomplete");
      }

      if (normalized.includes("credentials were rejected")) {
        return t("credentialsRejected");
      }

      if (normalized.includes("username was not found")) {
        return t("usernameNotFound");
      }

      if (normalized.includes("private or unavailable")) {
        return t("playlistUnavailable");
      }

      if (normalized.includes("rate limit")) {
        return t("rateLimited");
      }

      return message;
    },
    [t],
  );
  const normalizeSpotifyImportError = useCallback(
    (error: unknown): string => {
      const message = error instanceof Error ? error.message : null;
      const status =
        error instanceof ImportSpotifyPlaylistError ? error.status : undefined;
      const messageKey = getSpotifyImportErrorMessageKey({ message, status });

      if (messageKey) {
        return t(messageKey);
      }

      const sharedSpotifyMessage = normalizeSpotifyError(message);
      if (sharedSpotifyMessage && sharedSpotifyMessage !== message) {
        return sharedSpotifyMessage;
      }

      if (status === 400) {
        return t("importInvalidPlaylist");
      }

      return sharedSpotifyMessage ?? t("importFailedGeneric");
    },
    [normalizeSpotifyError, t],
  );
  const extractSpotifyImportDiagnostics = useCallback(
    (
      error: unknown,
      playlistId: string | null,
    ): SpotifyImportDiagnostics | null => {
      const status =
        error instanceof ImportSpotifyPlaylistError ? error.status : null;
      const payloadRecord =
        error instanceof ImportSpotifyPlaylistError
          ? asRecord(error.payload)
          : null;
      const nestedErrorRecord = asRecord(payloadRecord?.error);
      const errorCode =
        readFirstString(payloadRecord ?? {}, ["code", "errorCode"]) ??
        readFirstString(nestedErrorRecord ?? {}, ["code", "errorCode"]);
      const backendMessage = error instanceof Error ? error.message : null;

      if (!status && !errorCode && !backendMessage && !playlistId) {
        return null;
      }

      return {
        status,
        errorCode,
        backendMessage,
        playlistId,
      };
    },
    [],
  );
  const requestSpotifyPlaylistDetail = useCallback(
    async (playlistId: string): Promise<unknown> => {
      const response = await fetch(
        `/api/spotify/playlists/${encodeURIComponent(playlistId)}`,
        {
          cache: "no-store",
        },
      );

      if (response.status === 404) {
        throw new Error(t("importPlaylistNotFound"));
      }

      const payload = (await response.json()) as SpotifyPlaylistRouteResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Spotify playlist failed");
      }

      return payload.payload ?? null;
    },
    [t],
  );

  const buildSpotifyImportSourcePlaylist = useCallback(
    async (
      playlist: SpotifyImportPlaylistTarget,
    ): Promise<NonNullable<SpotifyImportRequest["sourcePlaylist"]>> => {
      const playlistPayload =
        selectedPlaylistId === playlist.id && selectedPlaylistPayload
          ? selectedPlaylistPayload
          : await requestSpotifyPlaylistDetail(playlist.id);
      const detail = extractSpotifyPlaylistSummary(playlistPayload);
      const tracks = extractSpotifyPlaylistTracks(playlistPayload);

      return {
        id: playlist.id,
        name: detail?.name ?? playlist.name,
        description: detail?.description ?? playlist.description,
        ownerName: detail?.ownerName ?? playlist.ownerName,
        trackCount:
          detail?.trackCount ?? playlist.trackCount ?? tracks.length ?? null,
        imageUrl: playlist.imageUrl,
        tracks: tracks.map((track, index) => ({
          index,
          spotifyTrackId: track.id,
          name: track.name,
          artist: track.artists[0] ?? null,
          artists: track.artists,
          albumName: track.albumName,
          durationMs: track.durationMs,
          externalUrl: track.externalUrl,
        })),
      };
    },
    [requestSpotifyPlaylistDetail, selectedPlaylistId, selectedPlaylistPayload],
  );

  const loadSpotifyPlaylists = useCallback(async () => {
    setIsPlaylistsLoading(true);
    setPlaylistsError(null);

    try {
      const response = await fetch("/api/spotify/playlists?limit=24", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SpotifyPlaylistRouteResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Spotify playlists failed");
      }

      setPlaylistsPayload(payload.payload ?? null);
    } catch (error) {
      setPlaylistsPayload(null);
      setPlaylistsError(
        normalizeSpotifyError(
          error instanceof Error ? error.message : "Spotify playlists failed",
        ),
      );
    } finally {
      setIsPlaylistsLoading(false);
    }
  }, [normalizeSpotifyError]);

  const loadSpotifyPlaylistDetail = useCallback(
    async (playlistId: string) => {
      setIsSelectedPlaylistLoading(true);
      setSelectedPlaylistError(null);

      try {
        const payload = await requestSpotifyPlaylistDetail(playlistId);
        setSelectedPlaylistPayload(payload);
      } catch (error) {
        setSelectedPlaylistPayload(null);
        setSelectedPlaylistError(
          normalizeSpotifyError(
            error instanceof Error ? error.message : "Spotify playlist failed",
          ),
        );
      } finally {
        setIsSelectedPlaylistLoading(false);
      }
    },
    [normalizeSpotifyError, requestSpotifyPlaylistDetail],
  );
  const importSpotifyPlaylistMutation =
    api.music.importSpotifyPlaylist.useMutation({
      fetchImpl: authFetch,
      onSuccess: async (result) => {
        setImportResult(result);
        setImportDiagnostics(null);
        await utils.music.getPlaylists.invalidate();
        showToast(
          t("importCompletedToast", {
            importedCount: result.importReport.matchedCount,
            totalCount: result.importReport.totalTracks,
            name: result.playlist.name,
          }),
          "success",
        );
        hapticSuccess();
      },
      onError: (error, variables) => {
        const message = normalizeSpotifyImportError(error);
        const diagnostics = extractSpotifyImportDiagnostics(
          error,
          variables?.spotifyPlaylistId ?? null,
        );
        setImportDiagnostics(diagnostics);
        setImportError(message);
        console.error("Spotify import failed", diagnostics ?? { message });
        showToast(message, "error");
      },
    });
  const openImportDialog = useCallback(
    (playlist: SpotifyImportPlaylistTarget) => {
      hapticLight();
      setImportPlaylist(playlist);
      setImportError(null);
      setImportDiagnostics(null);
      setImportResult(null);
      importSpotifyPlaylistMutation.reset();
      setIsImportDialogOpen(true);
    },
    [importSpotifyPlaylistMutation],
  );
  const closeImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
    setImportPlaylist(null);
    setImportError(null);
    setImportDiagnostics(null);
    setImportResult(null);
    setIsPreparingImportPayload(false);
    importSpotifyPlaylistMutation.reset();
  }, [importSpotifyPlaylistMutation]);
  const handleSpotifyPlaylistImport = useCallback(
    async (input: SpotifyImportRequest) => {
      if (!importPlaylist) {
        return;
      }

      setImportError(null);
      setImportDiagnostics(null);

      try {
        setIsPreparingImportPayload(true);
        const sourcePlaylist =
          input.sourcePlaylist ??
          (await buildSpotifyImportSourcePlaylist(importPlaylist));

        importSpotifyPlaylistMutation.mutate({
          ...input,
          sourcePlaylist,
        });
      } catch (error) {
        const message = normalizeSpotifyError(
          error instanceof Error
            ? error.message
            : "Spotify playlist import payload failed",
        );
        setImportError(message ?? t("importFailedGeneric"));
        setImportDiagnostics({
          status: null,
          errorCode: "playlist_payload_unavailable",
          backendMessage:
            error instanceof Error ? error.message : "Unknown import error",
          playlistId: importPlaylist.id,
        });
        showToast(message ?? t("importFailedGeneric"), "error");
      } finally {
        setIsPreparingImportPayload(false);
      }
    },
    [
      buildSpotifyImportSourcePlaylist,
      importPlaylist,
      importSpotifyPlaylistMutation,
      normalizeSpotifyError,
      showToast,
      t,
    ],
  );

  useEffect(() => {
    if (!canLoadPublicPlaylists) {
      setPlaylistsPayload(null);
      setPlaylistsError(null);
      setSelectedPlaylistId(null);
      setSelectedPlaylistPayload(null);
      setSelectedPlaylistError(null);
      return;
    }

    void loadSpotifyPlaylists();
  }, [canLoadPublicPlaylists, loadSpotifyPlaylists, serverSettings.updatedAt]);

  useEffect(() => {
    if (!spotifyPlaylists.length) return;

    setSelectedPlaylistId((current) => {
      if (!current) {
        return spotifyPlaylists[0]!.id;
      }

      return spotifyPlaylists.some((playlist) => playlist.id === current)
        ? current
        : spotifyPlaylists[0]!.id;
    });
  }, [spotifyPlaylists]);

  useEffect(() => {
    if (!selectedPlaylistId || !canLoadPublicPlaylists) {
      return;
    }

    void loadSpotifyPlaylistDetail(selectedPlaylistId);
  }, [canLoadPublicPlaylists, loadSpotifyPlaylistDetail, selectedPlaylistId]);

  if (status === "loading" || (session && isLoading)) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 h-12 w-48 animate-pulse rounded bg-(--color-muted)/20" />
        <div className="h-80 animate-pulse rounded-3xl border border-(--color-border) bg-(--color-surface)/60" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springPresets.gentle}
          className="text-center"
        >
          <Disc3 className="mx-auto mb-4 h-16 w-16 text-[#1DB954]" />
          <h1 className="mb-2 text-2xl font-bold text-(--color-text)">
            {t("signInRequired")}
          </h1>
          <p className="mb-6 max-w-md text-(--color-subtext)">
            {t("signInPrompt")}
          </p>
          <Link
            href="/signin?callbackUrl=%2Fspotify"
            className="inline-flex items-center gap-2 rounded-xl bg-(--color-accent) px-6 py-3 font-semibold text-(--color-on-accent) transition hover:opacity-90"
          >
            {tc("signIn")}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen w-full max-w-420 flex-col gap-4 px-3 py-5 md:px-6 md:py-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="relative overflow-hidden rounded-3xl border border-(--color-border) bg-[linear-gradient(135deg,rgba(29,185,84,0.14),rgba(17,24,39,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(29,185,84,0.22),transparent_58%)]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(29,185,84,0.14),transparent_72%)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#1DB954] uppercase">
                {t("migrationReady")}
              </span>
              <h1 className="text-3xl font-bold text-(--color-text) md:text-4xl">
                {t("browseForTranslation")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-(--color-subtext) md:text-base">
                {t("browseDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface)/85 px-4 py-2 text-sm font-medium text-(--color-text) transition hover:bg-(--color-surface-hover)"
              >
                <KeyRound className="h-4 w-4" />
                {t("openSettingsLink")}
              </Link>
              <a
                href="https://developer.spotify.com/documentation/web-api/concepts/apps"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-4 py-2 text-sm font-medium text-[#1DB954] transition hover:bg-[rgba(29,185,84,0.2)]"
              >
                {th("howTo")}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 md:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-(--color-subtext) uppercase">
                {tc("playlists")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-(--color-text)">
                {spotifyPlaylists.length}
              </p>
              <p className="mt-1 text-xs text-(--color-subtext)">
                {t("playlistMigration")}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-(--color-subtext) uppercase">
                {t("playlistDetail")}
              </p>
              <p className="mt-2 truncate text-base font-semibold text-(--color-text)">
                {selectedImportTarget?.name ?? t("spotifyPlaylist")}
              </p>
              <p className="mt-1 text-xs text-(--color-subtext)">
                {typeof selectedPlaylistTrackCount === "number"
                  ? tc("tracks", { count: selectedPlaylistTrackCount })
                  : t("trackCountUnknown")}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-3.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-(--color-subtext) uppercase">
                {t("savedAppProfile")}
              </p>
              <p className="mt-2 text-base font-semibold text-(--color-text)">
                {connectionStateLabel}
              </p>
              <p className="mt-1 text-xs text-(--color-subtext)">
                {summary.description}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr)] 2xl:grid-cols-[300px,minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springPresets.gentle, delay: 0.04 }}
          className="rounded-3xl border border-(--color-border) bg-(--color-surface)/80 p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-(--color-subtext)">
                {t("savedAppProfile")}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-(--color-text)">
                {t("featureProfileLabel")}
              </h2>
            </div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ${getStatusClasses(summary.state)}`}
            >
              {summary.state === "ready"
                ? tc("ready")
                : summary.state === "incomplete"
                  ? tc("incomplete")
                  : tc("inactive")}
            </span>
          </div>

          <p className="text-xs leading-5 text-(--color-subtext)">
            {t("savedProfileSummary")}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.checks.map((check) => (
              <div
                key={check.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  check.ready
                    ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)] text-[#1DB954]"
                    : "border-(--color-border) bg-(--color-surface-hover)/70 text-(--color-subtext)"
                }`}
              >
                {check.ready ? (
                  <CircleCheck className="h-3.5 w-3.5" />
                ) : (
                  <CircleAlert className="h-3.5 w-3.5" />
                )}
                <span>
                  {check.id === "enabled"
                    ? ts("checkEnabled")
                    : check.id === "clientId"
                      ? ts("checkClientId")
                      : check.id === "clientSecret"
                        ? ts("checkClientSecret")
                        : ts("checkUsername")}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-hover)/60 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <User2 className="mt-0.5 h-4 w-4 text-(--color-subtext)" />
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.16em] text-(--color-subtext) uppercase">
                    {ts("username")}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-(--color-text)">
                    {serverSettings.username || t("notSaved")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-hover)/60 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <KeyRound className="mt-0.5 h-4 w-4 text-(--color-subtext)" />
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.16em] text-(--color-subtext) uppercase">
                    {ts("clientIdPreview")}
                  </p>
                  <p className="mt-1 truncate font-mono text-sm text-(--color-text)">
                    {maskSpotifyClientId(serverSettings.clientId)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-hover)/60 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <KeyRound className="mt-0.5 h-4 w-4 text-(--color-subtext)" />
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.16em] text-(--color-subtext) uppercase">
                    {ts("clientSecret")}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-(--color-text)">
                    {serverSettings.clientSecretConfigured
                      ? ts("checkClientSecret")
                      : t("notSaved")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springPresets.gentle, delay: 0.08 }}
          className="min-w-0 rounded-3xl border border-(--color-border) bg-(--color-surface)/80 p-5"
        >
          <div className="flex flex-col gap-3 border-b border-(--color-border) pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-(--color-subtext)">
                {t("playlistMigration")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-(--color-text)">
                {serverSettings.username
                  ? t("playlistsForUsername", {
                      username: serverSettings.username,
                    })
                  : t("browseForTranslation")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-(--color-subtext)">
                {t("browseDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSpotifyPlaylists()}
              disabled={!canLoadPublicPlaylists || isPlaylistsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface-hover) px-3.5 py-2 text-sm font-medium text-(--color-text) transition hover:bg-(--color-surface-hover)/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaylistsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {tc("refresh")}
            </button>
          </div>

          {!canLoadPublicPlaylists ? (
            <div className="mt-6 rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-5 text-sm leading-6 text-amber-200">
              {t("settingsIncomplete")}
            </div>
          ) : playlistsError ? (
            <div className="mt-6 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-5 text-sm leading-6 text-red-200">
              {playlistsError}
            </div>
          ) : isPlaylistsLoading && spotifyPlaylists.length === 0 ? (
            <div className="mt-6 flex min-h-[240px] items-center justify-center rounded-2xl border border-(--color-border) bg-(--color-surface-hover)/50">
              <div className="flex items-center gap-3 text-(--color-subtext)">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("loadingPlaylists")}
              </div>
            </div>
          ) : spotifyPlaylists.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-(--color-border) bg-(--color-surface-hover)/50 p-5 text-sm leading-6 text-(--color-subtext)">
              {t("noPlaylistsReturned")}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-[280px,minmax(0,1fr)] 2xl:grid-cols-[300px,minmax(0,1fr)]">
              <div className="space-y-2.5">
                {spotifyPlaylists.map((playlist) => {
                  const isSelected = playlist.id === selectedPlaylistId;
                  return (
                    <div
                      key={playlist.id}
                      className={`group relative w-full overflow-hidden rounded-[1.35rem] border p-3.5 text-left transition duration-300 ${
                        isSelected
                          ? "translate-y-[-2px] border-[rgba(29,185,84,0.35)] bg-[linear-gradient(145deg,rgba(29,185,84,0.18),rgba(15,23,42,0.84))] shadow-[0_24px_64px_rgba(0,0,0,0.24)]"
                          : "border-(--color-border) bg-(--color-surface-hover)/55 hover:-translate-y-0.5 hover:border-white/10 hover:bg-(--color-surface-hover)/90 hover:shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
                      }`}
                    >
                      {playlist.imageUrl ? (
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={playlist.imageUrl}
                            alt=""
                            className="h-full w-full scale-125 object-cover blur-3xl"
                          />
                        </div>
                      ) : null}
                      <div
                        className={`absolute top-4 right-4 h-2.5 w-2.5 rounded-full ${
                          isSelected
                            ? "bg-[#1DB954] shadow-[0_0_0_6px_rgba(29,185,84,0.16)]"
                            : "bg-white/15"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                        className="relative w-full text-left"
                      >
                        <div className="flex items-start gap-2.5">
                          <PlaylistCover
                            imageUrl={playlist.imageUrl}
                            alt={playlist.name}
                            className="h-14 w-14 rounded-[1.1rem] shadow-[0_10px_28px_rgba(0,0,0,0.2)]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-(--color-text)">
                              {playlist.name}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-(--color-subtext)">
                              {t("byOwner", {
                                owner: playlist.ownerName ?? "Spotify",
                              })}
                              {" • "}
                              {typeof playlist.trackCount === "number"
                                ? tc("tracks", { count: playlist.trackCount })
                                : t("trackCountUnknown")}
                            </p>
                            {playlist.description ? (
                              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-(--color-subtext)/90">
                                {playlist.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      <div className="relative mt-3 border-t border-(--color-border)/80 pt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlaylistId(playlist.id);
                            openImportDialog(
                              toSpotifyImportPlaylistTarget(playlist),
                            );
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1DB954] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(29,185,84,0.22)] transition hover:brightness-110"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {t("importToStarchild")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="min-w-0 rounded-[1.5rem] border border-(--color-border) bg-(--color-surface-hover)/45 p-4">
                {selectedPlaylistFromList ? (
                  <>
                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border) bg-(--color-surface)/75">
                      {selectedPlaylistImageUrl ? (
                        <div className="pointer-events-none absolute inset-0 opacity-20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedPlaylistImageUrl}
                            alt=""
                            className="h-full w-full scale-125 object-cover blur-3xl"
                          />
                        </div>
                      ) : null}
                      <div className="relative flex flex-col gap-3 border-b border-(--color-border) p-4 md:flex-row">
                        <PlaylistCover
                          imageUrl={selectedPlaylistImageUrl}
                          alt={
                            selectedPlaylistDetail?.name ??
                            selectedPlaylistFromList.name
                          }
                          className="h-24 w-24 rounded-[1.4rem] border border-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
                          iconClassName="h-6 w-6"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                              {t("spotifyPlaylist")}
                            </span>
                            <h3 className="text-xl font-semibold text-(--color-text) lg:text-2xl">
                              {selectedPlaylistDetail?.name ??
                                selectedPlaylistFromList.name}
                            </h3>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            {selectedImportTarget ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openImportDialog(selectedImportTarget)
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(29,185,84,0.22)] transition hover:brightness-110"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                                {t("importToStarchild")}
                              </button>
                            ) : null}
                            {(selectedPlaylistDetail?.externalUrl ??
                            selectedPlaylistFromList.externalUrl) ? (
                              <a
                                href={
                                  selectedPlaylistDetail?.externalUrl ??
                                  selectedPlaylistFromList.externalUrl ??
                                  "#"
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-(--color-border) bg-(--color-surface)/70 px-3 py-1.5 text-xs font-medium text-(--color-subtext) transition hover:text-(--color-text)"
                              >
                                {t("openOnSpotify")}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-(--color-subtext)">
                            {t("ownedBy", {
                              owner: selectedPlaylistOwner,
                            })}
                            {" • "}
                            {typeof selectedPlaylistTrackCount === "number"
                              ? tc("tracks", {
                                  count: selectedPlaylistTrackCount,
                                })
                              : t("trackCountUnknown")}
                          </p>
                          {(selectedPlaylistDetail?.description ??
                          selectedPlaylistFromList.description) ? (
                            <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-(--color-subtext)">
                              {selectedPlaylistDetail?.description ??
                                selectedPlaylistFromList.description}
                            </p>
                          ) : (
                            <p className="mt-2.5 text-sm leading-6 text-(--color-subtext)">
                              {t("playlistMetadataFallback")}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-(--color-text)">
                              {typeof selectedPlaylistTrackCount === "number"
                                ? tc("tracks", {
                                    count: selectedPlaylistTrackCount,
                                  })
                                : t("trackCountUnknown")}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-(--color-text)">
                              {t("playlistMigration")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedPlaylistError ? (
                      <div className="mt-5 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-4 text-sm leading-6 text-red-200">
                        {selectedPlaylistError}
                      </div>
                    ) : isSelectedPlaylistLoading &&
                      selectedPlaylistTracks.length === 0 ? (
                      <div className="mt-5 flex min-h-[200px] items-center justify-center">
                        <div className="flex items-center gap-3 text-(--color-subtext)">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t("loadingTracks")}
                        </div>
                      </div>
                    ) : selectedPlaylistTracks.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-(--color-border) bg-(--color-surface)/65 p-4 text-sm leading-6 text-(--color-subtext)">
                        {t("noTrackRows")}
                      </div>
                    ) : (
                      <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-(--color-border) bg-(--color-surface)/50">
                        <div className="flex items-center justify-between gap-3 border-b border-(--color-border) px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-(--color-text)">
                              {t("playlistDetail")}
                            </p>
                            <p className="mt-1 text-xs text-(--color-subtext)">
                              {typeof selectedPlaylistTrackCount === "number"
                                ? tc("tracks", {
                                    count: selectedPlaylistTrackCount,
                                  })
                                : t("trackCountUnknown")}
                            </p>
                          </div>
                          <span className="rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                            {t("playlistMigration")}
                          </span>
                        </div>
                        <div className="space-y-2 p-3 lg:max-h-[560px] lg:overflow-y-auto">
                          {selectedPlaylistTracks
                            .slice(0, 25)
                            .map((track, index) => (
                              <div
                                key={track.id ?? `${track.name}-${index}`}
                                className="group flex items-center gap-3 rounded-[1.1rem] border border-(--color-border) bg-(--color-surface)/65 px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-white/10 hover:bg-(--color-surface)/80"
                              >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface-hover) text-[11px] font-semibold text-(--color-subtext)">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-(--color-text)">
                                    {track.name}
                                  </p>
                                  <p className="truncate text-xs text-(--color-subtext)">
                                    {track.artists.join(", ") ||
                                      tc("unknownArtist")}
                                    {track.albumName
                                      ? ` • ${track.albumName}`
                                      : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="rounded-full border border-(--color-border) bg-(--color-surface-hover) px-2.5 py-1 text-[11px] text-(--color-subtext)">
                                    {formatDuration(track.durationMs) ||
                                      tc("notAvailable")}
                                  </span>
                                  {track.externalUrl ? (
                                    <a
                                      href={track.externalUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-(--color-subtext) transition group-hover:text-(--color-text) hover:text-(--color-text)"
                                      aria-label={t("openTrackOnSpotify", {
                                        title: track.name,
                                      })}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-80 items-center justify-center text-center text-sm leading-6 text-(--color-subtext)">
                    {t("selectPlaylistPrompt")}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.section>
      </div>
      <SpotifyImportDialog
        key={importPlaylist?.id ?? "spotify-import-dialog"}
        isOpen={isImportDialogOpen}
        playlist={importPlaylist}
        isSubmitting={
          importSpotifyPlaylistMutation.isPending || isPreparingImportPayload
        }
        importError={importError}
        importDiagnostics={importDiagnostics}
        importResult={importResult}
        onClose={closeImportDialog}
        onSubmit={(input) => void handleSpotifyPlaylistImport(input)}
      />
    </div>
  );
}
