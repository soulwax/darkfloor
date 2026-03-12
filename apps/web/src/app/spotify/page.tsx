"use client";

import {
  SpotifyImportDialog,
  type SpotifyImportPlaylistTarget,
  type SpotifyImportRequest,
  type SpotifyImportResult,
} from "@/components/SpotifyImportDialog";
import { useToast } from "@/contexts/ToastContext";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import {
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  hasConfiguredSpotifyFeatureSettings,
  maskSpotifyClientId,
  maskSpotifyClientSecret,
  spotifyFeatureSettingsStorage,
} from "@/utils/spotifyFeatureSettings";
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
      return "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]";
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

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-[var(--color-muted)]/20 ${className}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <ListMusic className={`${iconClassName} text-[var(--color-subtext)]`} />
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

  const legacySettings = useMemo(
    () => spotifyFeatureSettingsStorage.getAll(),
    [],
  );
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
  const hasServerSettings = useMemo(
    () => hasConfiguredSpotifyFeatureSettings(serverSettings),
    [serverSettings],
  );
  const hasLegacyLocalOnly = useMemo(
    () =>
      !hasServerSettings && hasConfiguredSpotifyFeatureSettings(legacySettings),
    [hasServerSettings, legacySettings],
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
  const [importResult, setImportResult] = useState<SpotifyImportResult | null>(
    null,
  );

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
  const selectedImportTarget = useMemo<SpotifyImportPlaylistTarget | null>(
    () => {
      const source = selectedPlaylistDetail ?? selectedPlaylistFromList;
      return source ? toSpotifyImportPlaylistTarget(source) : null;
    },
    [selectedPlaylistDetail, selectedPlaylistFromList],
  );
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
        error instanceof ImportSpotifyPlaylistError
          ? error.status
          : undefined;

      if (message) {
        const normalized = message.toLowerCase();

        if (
          normalized.includes("invalid playlist") ||
          normalized.includes("playlist id") ||
          normalized.includes("playlist url") ||
          normalized.includes("200 tracks")
        ) {
          return t("importInvalidPlaylist");
        }

        if (
          normalized.includes("no matched tracks") ||
          normalized.includes("no tracks matched") ||
          normalized.includes("could not match")
        ) {
          return t("importNoMatches");
        }
      }

      const sharedSpotifyMessage = normalizeSpotifyError(message);
      if (sharedSpotifyMessage && sharedSpotifyMessage !== message) {
        return sharedSpotifyMessage;
      }

      if (status === 405 || status === 501) {
        return t("importUnavailable");
      }

      if (status === 400) {
        return t("importInvalidPlaylist");
      }

      if (status === 401) {
        return t("signInRequired");
      }

      if (status === 404) {
        return t("importPlaylistNotFound");
      }

      if (status === 412) {
        return t("importReconnectSpotify");
      }

      if (status === 403) {
        return t("playlistUnavailable");
      }

      if (status === 429) {
        return t("rateLimited");
      }

      if (status === 502) {
        return t("importUpstreamFailure");
      }

      return sharedSpotifyMessage ?? t("importFailedGeneric");
    },
    [normalizeSpotifyError, t],
  );

  useEffect(() => {
    if (!session || !hasServerSettings) {
      return;
    }

    spotifyFeatureSettingsStorage.save(serverSettings, {
      preserveUpdatedAt: true,
    });
  }, [hasServerSettings, serverSettings, session]);

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
        const response = await fetch(
          `/api/spotify/playlists/${encodeURIComponent(playlistId)}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as SpotifyPlaylistRouteResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Spotify playlist failed");
        }

        setSelectedPlaylistPayload(payload.payload ?? null);
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
    [normalizeSpotifyError],
  );
  const importSpotifyPlaylistMutation =
    api.music.importSpotifyPlaylist.useMutation({
      onSuccess: async (result) => {
        setImportResult(result);
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
      onError: (error) => {
        const message = normalizeSpotifyImportError(error);
        setImportError(message);
        showToast(message, "error");
      },
    });
  const openImportDialog = useCallback(
    (playlist: SpotifyImportPlaylistTarget) => {
      hapticLight();
      setImportPlaylist(playlist);
      setImportError(null);
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
    setImportResult(null);
    importSpotifyPlaylistMutation.reset();
  }, [importSpotifyPlaylistMutation]);
  const handleSpotifyPlaylistImport = useCallback(
    (input: SpotifyImportRequest) => {
      setImportError(null);
      importSpotifyPlaylistMutation.mutate(input);
    },
    [importSpotifyPlaylistMutation],
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
        <div className="mb-8 h-12 w-48 animate-pulse rounded bg-[var(--color-muted)]/20" />
        <div className="h-80 animate-pulse rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60" />
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
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
            {t("signInRequired")}
          </h1>
          <p className="mb-6 max-w-md text-[var(--color-subtext)]">
            {t("signInPrompt")}
          </p>
          <Link
            href="/signin?callbackUrl=%2Fspotify"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            {tc("signIn")}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(29,185,84,0.14),rgba(17,24,39,0.84))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(29,185,84,0.22),transparent_58%)]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(29,185,84,0.14),transparent_72%)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#1DB954] uppercase">
                {t("migrationReady")}
              </span>
              <h1 className="text-3xl font-bold text-[var(--color-text)] md:text-4xl">
                {t("browseForTranslation")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-subtext)] md:text-base">
                {t("browseDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]"
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

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                {tc("playlists")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {spotifyPlaylists.length}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtext)]">
                {t("playlistMigration")}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                {t("playlistDetail")}
              </p>
              <p className="mt-2 truncate text-base font-semibold text-[var(--color-text)]">
                {selectedImportTarget?.name ?? t("spotifyPlaylist")}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtext)]">
                {typeof selectedPlaylistTrackCount === "number"
                  ? tc("tracks", { count: selectedPlaylistTrackCount })
                  : t("trackCountUnknown")}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                {t("savedAppProfile")}
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
                {connectionStateLabel}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtext)]">
                {summary.description}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {hasLegacyLocalOnly ? (
        <div className="rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-4 text-sm text-amber-200">
          {t("localFallbackNotice")}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springPresets.gentle, delay: 0.04 }}
          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-subtext)]">
                {t("savedAppProfile")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                {t("featureProfileLabel")}
              </h2>
            </div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase ${getStatusClasses(summary.state)}`}
            >
              {summary.state === "ready"
                ? tc("ready")
                : summary.state === "incomplete"
                  ? tc("incomplete")
                  : tc("inactive")}
            </span>
          </div>

          <p className="text-sm leading-6 text-[var(--color-subtext)]">
            {t("savedProfileSummary")}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {summary.checks.map((check) => (
              <div
                key={check.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  check.ready
                    ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)] text-[#1DB954]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 text-[var(--color-subtext)]"
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

          <div className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
                <div className="flex items-start gap-3">
                  <User2 className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                      {ts("username")}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[var(--color-text)]">
                      {serverSettings.username || t("notSaved")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                      {ts("clientIdPreview")}
                    </p>
                    <p className="mt-1 truncate font-mono text-sm text-[var(--color-text)]">
                      {maskSpotifyClientId(serverSettings.clientId)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
                <div className="min-w-0">
                  <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                    {ts("clientSecret")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
                    {serverSettings.clientSecret.trim().length > 0
                      ? maskSpotifyClientSecret(serverSettings.clientSecret)
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
          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-6"
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-subtext)]">
                {t("playlistMigration")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                {serverSettings.username
                  ? t("playlistsForUsername", {
                      username: serverSettings.username,
                    })
                  : t("browseForTranslation")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-subtext)]">
                {t("browseDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSpotifyPlaylists()}
              disabled={!canLoadPublicPlaylists || isPlaylistsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]/80 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="mt-6 flex min-h-[240px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
              <div className="flex items-center gap-3 text-[var(--color-subtext)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("loadingPlaylists")}
              </div>
            </div>
          ) : spotifyPlaylists.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50 p-5 text-sm leading-6 text-[var(--color-subtext)]">
              {t("noPlaylistsReturned")}
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
              <div className="space-y-3">
                {spotifyPlaylists.map((playlist) => {
                  const isSelected = playlist.id === selectedPlaylistId;
                  return (
                    <div
                      key={playlist.id}
                      className={`group relative w-full overflow-hidden rounded-[1.6rem] border p-4 text-left transition duration-300 ${
                        isSelected
                          ? "translate-y-[-2px] border-[rgba(29,185,84,0.35)] bg-[linear-gradient(145deg,rgba(29,185,84,0.18),rgba(15,23,42,0.84))] shadow-[0_24px_64px_rgba(0,0,0,0.24)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 hover:-translate-y-0.5 hover:border-white/10 hover:bg-[var(--color-surface-hover)]/90 hover:shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
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
                        <div className="flex items-start gap-3">
                          <PlaylistCover
                            imageUrl={playlist.imageUrl}
                            alt={playlist.name}
                            className="h-16 w-16 rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.2)]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {playlist.name}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-subtext)]">
                              {t("byOwner", {
                                owner: playlist.ownerName ?? "Spotify",
                              })}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-[var(--color-text)]">
                                {typeof playlist.trackCount === "number"
                                  ? tc("tracks", { count: playlist.trackCount })
                                  : t("trackCountUnknown")}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-[var(--color-subtext)]">
                                {t("playlistMigration")}
                              </span>
                            </div>
                            {playlist.description ? (
                              <p className="mt-2 truncate text-xs text-[var(--color-subtext)]/90">
                                {playlist.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/80 pt-3">
                        <span className="text-[11px] font-medium tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                          {t("playlistMigration")}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlaylistId(playlist.id);
                            openImportDialog(
                              toSpotifyImportPlaylistTarget(playlist),
                            );
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-3 py-1.5 text-xs font-semibold text-[#1DB954] shadow-[0_12px_30px_rgba(29,185,84,0.18)] transition hover:bg-[rgba(29,185,84,0.22)] hover:shadow-[0_18px_36px_rgba(29,185,84,0.24)]"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {t("importToStarchild")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-5">
                {selectedPlaylistFromList ? (
                  <>
                    <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/75">
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
                      <div className="relative flex flex-col gap-4 border-b border-[var(--color-border)] p-5 md:flex-row">
                        <PlaylistCover
                          imageUrl={selectedPlaylistImageUrl}
                          alt={
                            selectedPlaylistDetail?.name ??
                            selectedPlaylistFromList.name
                          }
                          className="h-28 w-28 rounded-[1.75rem] border border-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
                          iconClassName="h-7 w-7"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex rounded-full border border-[rgba(29,185,84,0.3)] bg-[rgba(29,185,84,0.12)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#1DB954] uppercase">
                              {t("spotifyPlaylist")}
                            </span>
                            <h3 className="text-2xl font-semibold text-[var(--color-text)]">
                              {selectedPlaylistDetail?.name ??
                                selectedPlaylistFromList.name}
                            </h3>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {selectedImportTarget ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openImportDialog(selectedImportTarget)
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(29,185,84,0.22)] transition hover:brightness-110"
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
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3 py-1 text-xs font-medium text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
                              >
                                {t("openOnSpotify")}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-[var(--color-subtext)]">
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
                            <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                              {selectedPlaylistDetail?.description ??
                                selectedPlaylistFromList.description}
                            </p>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                              {t("playlistMetadataFallback")}
                            </p>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-[var(--color-text)]">
                              {typeof selectedPlaylistTrackCount === "number"
                                ? tc("tracks", {
                                    count: selectedPlaylistTrackCount,
                                  })
                                : t("trackCountUnknown")}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-[var(--color-text)]">
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
                        <div className="flex items-center gap-3 text-[var(--color-subtext)]">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t("loadingTracks")}
                        </div>
                      </div>
                    ) : selectedPlaylistTracks.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/65 p-4 text-sm leading-6 text-[var(--color-subtext)]">
                        {t("noTrackRows")}
                      </div>
                    ) : (
                      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/50">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {t("playlistDetail")}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-subtext)]">
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
                        <div className="space-y-3 p-3">
                        {selectedPlaylistTracks
                          .slice(0, 25)
                          .map((track, index) => (
                            <div
                              key={track.id ?? `${track.name}-${index}`}
                              className="group flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/65 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/10 hover:bg-[var(--color-surface)]/80"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-subtext)]">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                                  {track.name}
                                </p>
                                <p className="truncate text-xs text-[var(--color-subtext)]">
                                  {track.artists.join(", ") ||
                                    tc("unknownArtist")}
                                  {track.albumName
                                    ? ` • ${track.albumName}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs text-[var(--color-subtext)]">
                                  {formatDuration(track.durationMs) ||
                                    tc("notAvailable")}
                                </span>
                                {track.externalUrl ? (
                                  <a
                                    href={track.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--color-subtext)] transition group-hover:text-[var(--color-text)] hover:text-[var(--color-text)]"
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
                  <div className="flex min-h-[320px] items-center justify-center text-center text-sm leading-6 text-[var(--color-subtext)]">
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
        isSubmitting={importSpotifyPlaylistMutation.isPending}
        importError={importError}
        importResult={importResult}
        onClose={closeImportDialog}
        onSubmit={(input) => void handleSpotifyPlaylistImport(input)}
      />
    </div>
  );
}
