"use client";

import {
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  hasConfiguredSpotifyFeatureSettings,
  maskSpotifyClientSecret,
  spotifyFeatureSettingsStorage,
} from "@/utils/spotifyFeatureSettings";
import { api } from "@starchild/api-client/trpc/react";
import { springPresets } from "@/utils/spring-animations";
import {
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
    return payload;
  }

  const record = asRecord(payload);
  if (!record) return null;

  for (const key of keys) {
    const directValue = record[key];
    if (Array.isArray(directValue)) {
      return directValue;
    }

    const nestedRecord = asRecord(directValue);
    if (!nestedRecord) continue;

    for (const nestedKey of ["items", "data", "playlists", "tracks"]) {
      const nestedValue = nestedRecord[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue;
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

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) return "n/a";

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeSpotifyError(message: string | null): string | null {
  if (!message) return null;

  const normalized = message.toLowerCase();
  if (normalized.includes("settings are incomplete")) {
    return "Save your Spotify Client ID, Client Secret, and Username in Settings before loading public playlists.";
  }

  if (normalized.includes("credentials were rejected")) {
    return "Spotify rejected the saved Client ID or Client Secret. Update the app credentials in Settings.";
  }

  if (normalized.includes("username was not found")) {
    return "Spotify could not find that username. Check the username in Settings.";
  }

  if (normalized.includes("private or unavailable")) {
    return "That playlist is private or unavailable to app-based public playlist access.";
  }

  if (normalized.includes("rate limit")) {
    return "Spotify rate limited the request. Try again in a moment.";
  }

  return message;
}

export default function SpotifyPage() {
  const { data: session, status } = useSession();
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
  const selectedPlaylistTracks = useMemo(
    () => extractSpotifyPlaylistTracks(selectedPlaylistPayload),
    [selectedPlaylistPayload],
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
  }, []);

  const loadSpotifyPlaylistDetail = useCallback(async (playlistId: string) => {
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
  }, []);

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
            Sign in required
          </h1>
          <p className="mb-6 max-w-md text-[var(--color-subtext)]">
            Sign in with Discord to access the Spotify feature profile saved on
            your account.
          </p>
          <Link
            href="/signin?callbackUrl=%2Fspotify"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            Sign In
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
              Spotify features
            </span>
            <h1 className="text-3xl font-bold text-[var(--color-text)] md:text-4xl">
              Public Spotify playlists
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-subtext)] md:text-base">
              Your saved Spotify app credentials and username are enough to load
              the public playlists on that Spotify profile. That gives us a good
              base for migration tools next, without bringing Spotify OAuth back
              into sign-in.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]"
            >
              <KeyRound className="h-4 w-4" />
              Open Settings
            </Link>
            <a
              href="https://developer.spotify.com/documentation/web-api/concepts/apps"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] px-4 py-2 text-sm font-medium text-[#1DB954] transition hover:bg-[rgba(29,185,84,0.2)]"
            >
              How To
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </motion.section>

      {hasLegacyLocalOnly ? (
        <div className="rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-4 text-sm text-amber-200">
          Local Spotify values were found on this device, but the public
          playlist routes now read the account-saved profile from Settings. Save
          the Spotify section in Settings once to make these features work
          everywhere you sign in.
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
                Account profile
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                Spotify access
              </h2>
            </div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase ${getStatusClasses(summary.state)}`}
            >
              {summary.label}
            </span>
          </div>

          <p className="text-sm leading-6 text-[var(--color-subtext)]">
            {summary.description}
          </p>

          <div className="mt-5 space-y-3">
            {summary.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/70 px-4 py-3"
              >
                <span className="text-sm text-[var(--color-text)]">
                  {check.label}
                </span>
                {check.ready ? (
                  <CircleCheck className="h-4 w-4 text-[#1DB954]" />
                ) : (
                  <CircleAlert className="h-4 w-4 text-amber-300" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
            <div className="flex items-start gap-3">
              <User2 className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                  Username
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
                  {serverSettings.username || "Not saved"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                  Client ID
                </p>
                <p className="mt-1 text-sm font-medium break-all text-[var(--color-text)]">
                  {serverSettings.clientId || "Not saved"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-[var(--color-subtext)]" />
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--color-subtext)] uppercase">
                  Client Secret
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
                  {maskSpotifyClientSecret(serverSettings.clientSecret)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(29,185,84,0.24)] bg-[rgba(29,185,84,0.1)] p-4 text-sm leading-6 text-[var(--color-subtext)]">
            No Spotify login is involved here. The server uses your saved app
            credentials to request an app token and read public playlists for
            the saved username only.
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
                Playlist browser
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                Public playlists for @{serverSettings.username || "username"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-subtext)]">
                This is the current Spotify data surface. Playlist migration can
                build on the same public playlist inventory later.
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
              Refresh
            </button>
          </div>

          {!canLoadPublicPlaylists ? (
            <div className="mt-6 rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-5 text-sm leading-6 text-amber-200">
              Save a complete Spotify feature profile in Settings first. Once
              the Client ID, Client Secret, and Username are all present, this
              page becomes active automatically for the signed-in user.
            </div>
          ) : playlistsError ? (
            <div className="mt-6 rounded-2xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] p-5 text-sm leading-6 text-red-200">
              {playlistsError}
            </div>
          ) : isPlaylistsLoading && spotifyPlaylists.length === 0 ? (
            <div className="mt-6 flex min-h-[240px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
              <div className="flex items-center gap-3 text-[var(--color-subtext)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading public Spotify playlists...
              </div>
            </div>
          ) : spotifyPlaylists.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50 p-5 text-sm leading-6 text-[var(--color-subtext)]">
              No public playlists were returned for this username yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
              <div className="space-y-3">
                {spotifyPlaylists.map((playlist) => {
                  const isSelected = playlist.id === selectedPlaylistId;
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.12)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-hover)]/55 hover:bg-[var(--color-surface-hover)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-muted)]/20">
                          {playlist.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={playlist.imageUrl}
                              alt={playlist.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ListMusic className="h-5 w-5 text-[var(--color-subtext)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {playlist.name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-subtext)]">
                            {playlist.ownerName || "Spotify"}
                          </p>
                          <p className="mt-2 text-xs text-[var(--color-subtext)]">
                            {playlist.trackCount ?? "?"} tracks
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/45 p-5">
                {selectedPlaylistFromList ? (
                  <>
                    <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 md:flex-row">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-muted)]/20">
                        {selectedPlaylistFromList.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedPlaylistFromList.imageUrl}
                            alt={selectedPlaylistFromList.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ListMusic className="h-7 w-7 text-[var(--color-subtext)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-semibold text-[var(--color-text)]">
                            {selectedPlaylistDetail?.name ??
                              selectedPlaylistFromList.name}
                          </h3>
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
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
                            >
                              Open in Spotify
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-[var(--color-subtext)]">
                          {(selectedPlaylistDetail?.ownerName ??
                            selectedPlaylistFromList.ownerName ??
                            "Spotify") +
                            " • " +
                            String(
                              selectedPlaylistDetail?.trackCount ??
                                selectedPlaylistFromList.trackCount ??
                                "?",
                            ) +
                            " tracks"}
                        </p>
                        {(selectedPlaylistDetail?.description ??
                        selectedPlaylistFromList.description) ? (
                          <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                            {selectedPlaylistDetail?.description ??
                              selectedPlaylistFromList.description}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-[var(--color-subtext)]">
                            Public playlist metadata is available now. Playlist
                            translation and migration logic can build on this
                            inventory later.
                          </p>
                        )}
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
                          Loading playlist detail...
                        </div>
                      </div>
                    ) : selectedPlaylistTracks.length === 0 ? (
                      <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/65 p-4 text-sm leading-6 text-[var(--color-subtext)]">
                        Track detail is not available yet for this playlist
                        payload.
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
                                  {track.artists.join(", ") || "Unknown artist"}
                                  {track.albumName
                                    ? ` • ${track.albumName}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-[var(--color-subtext)]">
                                  {formatDuration(track.durationMs)}
                                </span>
                                {track.externalUrl ? (
                                  <a
                                    href={track.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
                                    aria-label={`Open ${track.name} in Spotify`}
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
                    Select a playlist to inspect the public track payload.
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
