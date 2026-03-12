"use client";

import {
  SpotifyImportDialog,
  type SpotifyImportPlaylistTarget,
  type SpotifyImportRequest,
  type SpotifyImportResult,
  type SpotifyImportUnmatchedReason,
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
import { api } from "@starchild/api-client/trpc/react";
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

const SPOTIFY_IMPORT_UNMATCHED_REASONS = new Set<
  SpotifyImportUnmatchedReason
>(["not_found", "ambiguous", "invalid", "unsupported"]);

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

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
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

function extractRouteErrorMessage(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;

  const directMessage = readFirstString(record, ["error", "message"]);
  if (directMessage) {
    return directMessage;
  }

  const errorRecord = asRecord(record.error);
  return errorRecord ? readFirstString(errorRecord, ["message", "error"]) : null;
}

function isSpotifyImportUnmatchedReason(
  value: string | null,
): value is SpotifyImportUnmatchedReason {
  return value
    ? SPOTIFY_IMPORT_UNMATCHED_REASONS.has(value as SpotifyImportUnmatchedReason)
    : false;
}

function extractSpotifyImportResult(
  payload: unknown,
): SpotifyImportResult | null {
  const record = asRecord(payload);
  if (record?.ok !== true) {
    return null;
  }

  const playlistRecord = asRecord(record.playlist);
  const reportRecord = asRecord(record.importReport);
  if (!playlistRecord || !reportRecord) {
    return null;
  }

  const playlistId = readFirstNumber(playlistRecord, ["id"]);
  const playlistName = readFirstString(playlistRecord, ["name"]);
  if (playlistId === null || !playlistName) {
    return null;
  }

  const unmatched = Array.isArray(reportRecord.unmatched)
    ? reportRecord.unmatched
        .map((entry) => {
          const entryRecord = asRecord(entry);
          if (!entryRecord) return null;

          const index = readFirstNumber(entryRecord, ["index"]);
          const name = readFirstString(entryRecord, ["name", "title"]);
          if (index === null || !name) {
            return null;
          }

          const reason = readFirstString(entryRecord, ["reason"]);

          return {
            index,
            spotifyTrackId: readFirstString(entryRecord, [
              "spotifyTrackId",
              "trackId",
            ]),
            name,
            artist: readFirstString(entryRecord, ["artist", "artistName"]),
            reason: isSpotifyImportUnmatchedReason(reason)
              ? reason
              : "not_found",
          };
        })
        .filter(
          (
            value,
          ): value is SpotifyImportResult["importReport"]["unmatched"][number] =>
            value !== null,
        )
    : [];

  return {
    ok: true,
    playlist: {
      id: playlistId,
      name: playlistName,
    },
    importReport: {
      sourcePlaylistId:
        readFirstString(reportRecord, ["sourcePlaylistId"]) ?? "",
      sourcePlaylistName:
        readFirstString(reportRecord, ["sourcePlaylistName"]) ?? playlistName,
      totalTracks: readFirstNumber(reportRecord, ["totalTracks"]) ?? 0,
      matchedCount: readFirstNumber(reportRecord, ["matchedCount"]) ?? 0,
      unmatchedCount:
        readFirstNumber(reportRecord, ["unmatchedCount"]) ?? unmatched.length,
      skippedCount: readFirstNumber(reportRecord, ["skippedCount"]) ?? 0,
      unmatched,
    },
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
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
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
    (message: string | null, status?: number): string => {
      if (message) {
        const normalized = message.toLowerCase();

        if (
          normalized.includes("invalid playlist") ||
          normalized.includes("playlist id") ||
          normalized.includes("playlist url")
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

      if (status === 404 || status === 405 || status === 501) {
        return t("importUnavailable");
      }

      if (status === 400) {
        return t("importInvalidPlaylist");
      }

      if (status === 403) {
        return t("playlistUnavailable");
      }

      if (status === 429) {
        return t("rateLimited");
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
  const openImportDialog = useCallback(
    (playlist: SpotifyImportPlaylistTarget) => {
      hapticLight();
      setImportPlaylist(playlist);
      setImportError(null);
      setImportResult(null);
      setIsImportDialogOpen(true);
    },
    [],
  );
  const closeImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
    setImportPlaylist(null);
    setImportError(null);
    setImportResult(null);
  }, []);
  const handleSpotifyPlaylistImport = useCallback(
    async (input: SpotifyImportRequest) => {
      setIsImportSubmitting(true);
      setImportError(null);

      try {
        const response = await fetch("/api/spotify/playlists/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(input),
        });
        const payload = await readJsonSafely(response);
        const payloadRecord = asRecord(payload);
        const routeErrorMessage = extractRouteErrorMessage(payload);

        if (!response.ok || payloadRecord?.ok === false) {
          throw new Error(
            normalizeSpotifyImportError(routeErrorMessage, response.status),
          );
        }

        const result = extractSpotifyImportResult(payload);
        if (!result) {
          throw new Error(
            normalizeSpotifyImportError(routeErrorMessage, response.status),
          );
        }

        setImportResult(result);
        await utils.music.getPlaylists.invalidate();
        showToast(
          t("importCompletedToast", {
            name: result.playlist.name,
          }),
          "success",
        );
        hapticSuccess();
      } catch (error) {
        const message = normalizeSpotifyImportError(
          error instanceof Error ? error.message : null,
        );
        setImportError(message);
        showToast(message, "error");
      } finally {
        setIsImportSubmitting(false);
      }
    },
    [normalizeSpotifyImportError, showToast, t, utils.music.getPlaylists],
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
        className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(29,185,84,0.14),rgba(17,24,39,0.84))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
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
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 hover:bg-[var(--color-surface-hover)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                        className="w-full text-left"
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
                            <p className="mt-2 text-xs text-[var(--color-subtext)]">
                              {typeof playlist.trackCount === "number"
                                ? tc("tracks", { count: playlist.trackCount })
                                : t("trackCountUnknown")}
                            </p>
                            {playlist.description ? (
                              <p className="mt-2 truncate text-xs text-[var(--color-subtext)]/90">
                                {playlist.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/80 pt-3">
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
                          className="inline-flex items-center gap-2 rounded-full border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-3 py-1.5 text-xs font-semibold text-[#1DB954] transition hover:bg-[rgba(29,185,84,0.2)]"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {t("importToStarchild")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-5">
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
                              owner:
                                selectedPlaylistDetail?.ownerName ??
                                selectedPlaylistFromList.ownerName ??
                                "Spotify",
                            })}
                            {" • "}
                            {typeof (
                              selectedPlaylistDetail?.trackCount ??
                              selectedPlaylistFromList.trackCount
                            ) === "number"
                              ? tc("tracks", {
                                  count:
                                    selectedPlaylistDetail?.trackCount ??
                                    selectedPlaylistFromList.trackCount ??
                                    0,
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
                      <div className="mt-5 space-y-3">
                        {selectedPlaylistTracks
                          .slice(0, 25)
                          .map((track, index) => (
                            <div
                              key={track.id ?? `${track.name}-${index}`}
                              className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/65 px-4 py-3"
                            >
                              <div className="w-7 text-xs font-semibold text-[var(--color-subtext)]">
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
                                <span className="text-xs text-[var(--color-subtext)]">
                                  {formatDuration(track.durationMs) ||
                                    tc("notAvailable")}
                                </span>
                                {track.externalUrl ? (
                                  <a
                                    href={track.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
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
        isSubmitting={isImportSubmitting}
        importError={importError}
        importResult={importResult}
        onClose={closeImportDialog}
        onSubmit={(input) => void handleSpotifyPlaylistImport(input)}
      />
    </div>
  );
}
