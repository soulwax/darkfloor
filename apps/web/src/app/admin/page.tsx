// File: apps/web/src/app/admin/page.tsx

"use client";

import { useToast } from "@/contexts/ToastContext";
import { ensureAccessToken } from "@/services/spotifyAuthClient";
import { api } from "@starchild/api-client/trpc/react";
import {
  Activity,
  BarChart3,
  CircleAlert,
  CircleCheck,
  Crown,
  FileText,
  Gauge,
  Ban,
  Link2,
  Loader2,
  Lock,
  Shield,
  RefreshCcw,
  Trash2,
  Users2,
  UserX,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ApiDiagnosticTarget = {
  key: string;
  label: string;
  path: string;
};

type ApiDiagnosticResult = {
  key: string;
  label: string;
  path: string;
  status: number | null;
  ok: boolean;
  state: "healthy" | "degraded" | "down";
  payloadPreview: string;
  fetchedAt: string;
  error?: string;
};

type OAuthDumpFetchEntry = {
  timestamp: string;
  label: string;
  phase: "request" | "response" | "error";
  details?: unknown;
};

type OAuthDumpLogEntry = {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  details?: unknown;
};

type OAuthDumpResponse = {
  ok: boolean;
  source?: string;
  oauthVerboseDebugEnabled?: boolean;
  fetchedAt?: string;
  fetchDumpCount?: number;
  authLogCount?: number;
  fetchDump?: OAuthDumpFetchEntry[];
  authLogs?: OAuthDumpLogEntry[];
  error?: string;
};

type UpstreamOAuthDumpResult = {
  status: number;
  fetchedAt: string;
  traceId: string | null;
  limit: number;
  payload: unknown;
};

type UpstreamOAuthDumpEntry = {
  timestamp: string | null;
  level: string | null;
  title: string;
  details: unknown;
};

type SpotifyAdminFetchResult = {
  status: number;
  fetchedAt: string;
  payload: unknown;
};

type SpotifyAdminProfileSummary = {
  connected: boolean | null;
  displayName: string | null;
  email: string | null;
  spotifyUserId: string | null;
  country: string | null;
  product: string | null;
  followerCount: number | null;
  imageUrl: string | null;
  scopeText: string | null;
};

type SpotifyAdminPlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  trackCount: number | null;
  imageUrl: string | null;
  externalUrl: string | null;
  raw: unknown;
};

type SpotifyAdminTrackSummary = {
  id: string | null;
  name: string;
  artists: string[];
  albumName: string | null;
  durationMs: number | null;
  imageUrl: string | null;
  externalUrl: string | null;
  raw: unknown;
};

const BASIC_SPOTIFY_LOGIN_SCOPES = [
  "user-read-email",
  "user-read-private",
] as const;

const SPOTIFY_PLAYLIST_READ_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

const API_DIAGNOSTIC_TARGETS: ApiDiagnosticTarget[] = [
  { key: "status", label: "Liveness", path: "/api/v2/status" },
  { key: "version", label: "Version", path: "/api/v2/version" },
  { key: "ready", label: "Readiness", path: "/api/v2/health/ready" },
  { key: "config", label: "Public Config", path: "/api/v2/config/public" },
  { key: "limits", label: "Rate Limits", path: "/api/v2/rate-limits" },
  { key: "cache", label: "Cache Stats", path: "/api/v2/cache/stats" },
  {
    key: "streamCaps",
    label: "Stream Capabilities",
    path: "/api/v2/music/stream/capabilities",
  },
  { key: "authMe", label: "Auth Session", path: "/api/v2/auth/me" },
];

const API_DIAGNOSTIC_AUTH_KEYS = new Set(["cache", "authMe"]);

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

function readFirstBoolean(
  record: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
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

  const root = asRecord(payload);
  if (!root) return null;

  for (const key of keys) {
    const directValue = root[key];
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

function extractSpotifyScopeText(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  const directScope = readFirstString(root, ["scope", "scopes"]);
  if (directScope) return directScope;

  for (const key of ["profile", "user", "spotifyProfile", "connection"]) {
    const nestedRecord = asRecord(root[key]);
    if (!nestedRecord) continue;
    const nestedScope = readFirstString(nestedRecord, ["scope", "scopes"]);
    if (nestedScope) return nestedScope;
  }

  const scopes = root.scopes;
  if (Array.isArray(scopes)) {
    const values = scopes.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
    if (values.length > 0) {
      return values.join(", ");
    }
  }

  return null;
}

function normalizeSpotifyScopes(scopeText: string | null): string[] {
  if (!scopeText) return [];

  return Array.from(
    new Set(
      scopeText
        .split(/[,\s]+/u)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0),
    ),
  );
}

function hasAnySpotifyScope(
  scopes: string[],
  requiredScopes: readonly string[],
): boolean {
  return requiredScopes.some((scope) => scopes.includes(scope));
}

function hasAllSpotifyScopes(
  scopes: string[],
  requiredScopes: readonly string[],
): boolean {
  return requiredScopes.every((scope) => scopes.includes(scope));
}

function normalizeSpotifyPlaylistAccessError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("403") ||
    normalized.includes("forbidden") ||
    normalized.includes("insufficient") ||
    normalized.includes("scope")
  ) {
    return "Spotify playlist data is not available for this session. Basic Spotify login now grants profile scopes only; playlist access should use a separate elevated-consent flow.";
  }

  return message;
}

function extractSpotifyProfileSummary(
  payload: unknown,
): SpotifyAdminProfileSummary {
  const root = asRecord(payload);
  const profile =
    asRecord(root?.profile) ??
    asRecord(root?.spotifyProfile) ??
    asRecord(root?.user) ??
    asRecord(root?.account) ??
    root;

  const connected =
    (root
      ? readFirstBoolean(root, ["connected", "isConnected", "hasConnection"])
      : null) ??
    (profile
      ? readFirstBoolean(profile, ["connected", "isConnected", "hasConnection"])
      : null);

  const followers =
    readFirstNumber(profile ?? {}, ["followers", "followerCount"]) ??
    readFirstNumber(asRecord(profile?.followers) ?? {}, ["total"]);

  return {
    connected,
    displayName: readFirstString(profile ?? {}, [
      "display_name",
      "displayName",
      "name",
      "username",
    ]),
    email: readFirstString(profile ?? {}, ["email"]),
    spotifyUserId: readFirstString(profile ?? {}, ["id", "spotifyUserId"]),
    country: readFirstString(profile ?? {}, ["country"]),
    product: readFirstString(profile ?? {}, ["product"]),
    followerCount: followers,
    imageUrl:
      extractFirstImageUrl(profile?.images) ??
      readFirstString(profile ?? {}, ["image", "imageUrl", "avatarUrl"]),
    scopeText: extractSpotifyScopeText(payload),
  };
}

function extractSpotifyPlaylistSummaries(
  payload: unknown,
): SpotifyAdminPlaylistSummary[] {
  const entries =
    extractArrayCandidates(payload, ["items", "playlists", "data"]) ?? [];

  return entries
    .map((entry): SpotifyAdminPlaylistSummary | null => {
      const record = asRecord(entry);
      if (!record) return null;

      const id = readFirstString(record, ["id", "playlistId"]);
      const name = readFirstString(record, ["name", "title"]);

      if (!id || !name) {
        return null;
      }

      const owner = asRecord(record.owner);
      const tracks = asRecord(record.tracks);
      const externalUrls = asRecord(record.external_urls);

      return {
        id,
        name,
        description: readFirstString(record, ["description"]),
        ownerName: readFirstString(owner ?? {}, ["display_name", "name"]),
        trackCount:
          readFirstNumber(tracks ?? {}, ["total"]) ??
          readFirstNumber(record, ["trackCount"]),
        imageUrl:
          extractFirstImageUrl(record.images) ??
          readFirstString(record, ["image", "imageUrl"]),
        externalUrl:
          readFirstString(externalUrls ?? {}, ["spotify"]) ??
          readFirstString(record, ["href", "uri", "link"]),
        raw: entry,
      };
    })
    .filter((value): value is SpotifyAdminPlaylistSummary => value !== null);
}

function extractSpotifyPlaylistTracks(
  payload: unknown,
): SpotifyAdminTrackSummary[] {
  const root = asRecord(payload);
  const tracksRecord = asRecord(root?.tracks);
  const entries =
    (Array.isArray(tracksRecord?.items) ? tracksRecord?.items : null) ??
    extractArrayCandidates(payload, ["items", "tracks", "data"]) ??
    [];

  return entries
    .map((entry): SpotifyAdminTrackSummary | null => {
      const record = asRecord(entry);
      if (!record) return null;

      const trackRecord = asRecord(record.track) ?? record;
      const name = readFirstString(trackRecord, ["name", "title"]);
      if (!name) return null;

      const artistsValue = trackRecord.artists;
      const artists = Array.isArray(artistsValue)
        ? artistsValue
            .map((artist) => readFirstString(asRecord(artist) ?? {}, ["name"]))
            .filter((value): value is string => Boolean(value))
        : [];
      const album = asRecord(trackRecord.album);
      const externalUrls = asRecord(trackRecord.external_urls);

      return {
        id: readFirstString(trackRecord, ["id", "trackId"]),
        name,
        artists,
        albumName: readFirstString(album ?? {}, ["name", "title"]),
        durationMs: readFirstNumber(trackRecord, ["duration_ms", "durationMs"]),
        imageUrl:
          extractFirstImageUrl(album?.images) ??
          readFirstString(album ?? {}, ["image", "imageUrl"]),
        externalUrl:
          readFirstString(externalUrls ?? {}, ["spotify"]) ??
          readFirstString(trackRecord, ["href", "uri", "link"]),
        raw: entry,
      };
    })
    .filter((value): value is SpotifyAdminTrackSummary => value !== null);
}

function formatDurationMs(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return "n/a";
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extractUpstreamOAuthDumpEntries(
  payload: unknown,
): UpstreamOAuthDumpEntry[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as Record<string, unknown>;
  const candidateCollections = [
    "events",
    "entries",
    "logs",
    "records",
    "items",
    "data",
  ];

  for (const candidateKey of candidateCollections) {
    const candidateValue = root[candidateKey];
    if (!Array.isArray(candidateValue)) continue;

    return candidateValue
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return {
            timestamp: null,
            level: null,
            title: `${candidateKey}[${index}]`,
            details: entry,
          };
        }

        const typedEntry = entry as Record<string, unknown>;
        const timestamp = readFirstString(typedEntry, [
          "timestamp",
          "time",
          "createdAt",
          "occurredAt",
        ]);
        const level = readFirstString(typedEntry, [
          "level",
          "phase",
          "type",
          "severity",
        ]);
        const title =
          readFirstString(typedEntry, [
            "message",
            "label",
            "event",
            "action",
            "route",
            "path",
            "url",
          ]) ?? `${candidateKey}[${index}]`;

        return {
          timestamp,
          level,
          title,
          details: typedEntry,
        };
      })
      .slice(-400);
  }

  return [];
}

function parseBoundedInt(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function getErrorMessageFromPayload(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const message =
    (typeof record.message === "string" && record.message.trim().length > 0
      ? record.message
      : null) ??
    (typeof record.error === "string" && record.error.trim().length > 0
      ? record.error
      : null) ??
    (typeof record.detail === "string" && record.detail.trim().length > 0
      ? record.detail
      : null);

  return message;
}

function toPreviewText(rawText: string): string {
  if (!rawText.trim()) return "(empty)";

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const pretty = JSON.stringify(parsed, null, 2);
    if (!pretty) return "(empty)";
    return pretty.length > 600 ? `${pretty.slice(0, 600)}\n...` : pretty;
  } catch {
    return rawText.length > 600 ? `${rawText.slice(0, 600)}\n...` : rawText;
  }
}

function toJsonPreview(value: unknown): string {
  try {
    const pretty = JSON.stringify(value, null, 2) ?? "";
    if (!pretty.trim()) return "(empty)";
    return pretty.length > 1200 ? `${pretty.slice(0, 1200)}\n...` : pretty;
  } catch {
    return "(unserializable)";
  }
}

function getResultState(
  status: number | null,
): "healthy" | "degraded" | "down" {
  if (status === null) return "down";
  if (status >= 500) return "down";
  if (status >= 400) return "degraded";
  return "healthy";
}

async function probeApiTarget(
  target: ApiDiagnosticTarget,
  accessToken: string | null,
): Promise<ApiDiagnosticResult> {
  try {
    const headers = new Headers();
    if (accessToken && API_DIAGNOSTIC_AUTH_KEYS.has(target.key)) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(target.path, {
      cache: "no-store",
      credentials: "same-origin",
      headers,
    });
    const rawText = await response.text().catch(() => "");

    return {
      key: target.key,
      label: target.label,
      path: target.path,
      status: response.status,
      ok: response.ok,
      state: getResultState(response.status),
      payloadPreview: toPreviewText(rawText),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      key: target.key,
      label: target.label,
      path: target.path,
      status: null,
      ok: false,
      state: "down",
      payloadPreview: "(no response)",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const { showToast } = useToast();

  const {
    data: users,
    isLoading,
    isFetching,
    refetch,
    error,
  } = api.admin.listUsers.useQuery(
    { limit: 200 },
    {
      enabled: !!session?.user?.admin,
      staleTime: 10_000,
    },
  );

  const updateAdmin = api.admin.setAdmin.useMutation({
    onSuccess: async () => {
      showToast("User permissions updated", "success");
      await refetch();
    },
    onError: (err) => {
      showToast(err.message ?? "Failed to update user", "error");
    },
  });

  const updateBanned = api.admin.setBanned.useMutation({
    onSuccess: async () => {
      showToast("User ban status updated", "success");
      await refetch();
    },
    onError: (err) => {
      showToast(err.message ?? "Failed to update ban status", "error");
    },
  });

  const removeUser = api.admin.removeUser.useMutation({
    onSuccess: async () => {
      showToast("User removed", "success");
      await refetch();
    },
    onError: (err) => {
      showToast(err.message ?? "Failed to remove user", "error");
    },
  });

  const isAuthorized = useMemo(
    () => session?.user?.admin === true,
    [session?.user?.admin],
  );
  const isFirstAdmin = session?.user?.firstAdmin === true;
  const [diagnosticResults, setDiagnosticResults] = useState<
    ApiDiagnosticResult[]
  >([]);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isRefreshingUpstreamAuth, setIsRefreshingUpstreamAuth] =
    useState(false);
  const [oauthDump, setOauthDump] = useState<OAuthDumpResponse | null>(null);
  const [isOAuthDumpLoading, setIsOAuthDumpLoading] = useState(false);
  const [upstreamOAuthDump, setUpstreamOAuthDump] =
    useState<UpstreamOAuthDumpResult | null>(null);
  const [isUpstreamOAuthDumpLoading, setIsUpstreamOAuthDumpLoading] =
    useState(false);
  const [upstreamOAuthTraceIdInput, setUpstreamOAuthTraceIdInput] =
    useState("");
  const [upstreamOAuthLimitInput, setUpstreamOAuthLimitInput] = useState("200");
  const upstreamOAuthTraceIdRef = useRef(upstreamOAuthTraceIdInput);
  const upstreamOAuthLimitRef = useRef(upstreamOAuthLimitInput);
  const [spotifyProfileData, setSpotifyProfileData] =
    useState<SpotifyAdminFetchResult | null>(null);
  const [spotifyPlaylistsData, setSpotifyPlaylistsData] =
    useState<SpotifyAdminFetchResult | null>(null);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState<
    string | null
  >(null);
  const [selectedSpotifyPlaylistData, setSelectedSpotifyPlaylistData] =
    useState<SpotifyAdminFetchResult | null>(null);
  const [isSpotifyAdminLoading, setIsSpotifyAdminLoading] = useState(false);
  const [isSpotifyPlaylistsLoading, setIsSpotifyPlaylistsLoading] =
    useState(false);
  const [isSpotifyPlaylistDetailLoading, setIsSpotifyPlaylistDetailLoading] =
    useState(false);
  const [spotifyAdminError, setSpotifyAdminError] = useState<string | null>(
    null,
  );
  const [spotifyTokenUnavailable, setSpotifyTokenUnavailable] = useState(false);

  const handleToggleAdmin = (userId: string, admin: boolean) => {
    updateAdmin.mutate({ userId, admin: !admin });
  };

  const handleToggleBanned = (userId: string, banned: boolean) => {
    updateBanned.mutate({ userId, banned: !banned });
  };

  const handleRemoveUser = (userId: string, userLabel: string) => {
    const confirmed = window.confirm(
      `Remove ${userLabel}? This permanently deletes their account and related data.`,
    );
    if (!confirmed) return;
    removeUser.mutate({ userId });
  };

  const refreshDiagnostics = useCallback(async () => {
    setIsDiagnosticsLoading(true);
    try {
      const accessToken = await ensureAccessToken();
      const results = await Promise.all(
        API_DIAGNOSTIC_TARGETS.map((target) =>
          probeApiTarget(target, accessToken),
        ),
      );
      setDiagnosticResults(results);
    } finally {
      setIsDiagnosticsLoading(false);
    }
  }, []);

  const handleRefreshUpstreamAuth = useCallback(async () => {
    setIsRefreshingUpstreamAuth(true);
    try {
      const accessToken = await ensureAccessToken();
      const response = await fetch("/api/v2/auth/refresh", {
        cache: "no-store",
        credentials: "same-origin",
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      const payloadText = await response.text().catch(() => "");
      if (!response.ok) {
        showToast(
          `Auth refresh failed (${response.status})${
            payloadText ? `: ${payloadText.slice(0, 120)}` : ""
          }`,
          "error",
        );
        return;
      }
      showToast("Upstream auth refresh succeeded", "success");
      await refreshDiagnostics();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Auth refresh failed",
        "error",
      );
    } finally {
      setIsRefreshingUpstreamAuth(false);
    }
  }, [refreshDiagnostics, showToast]);

  const handleClearCaches = useCallback(async () => {
    const confirmed = window.confirm(
      "Clear upstream caches now? This may temporarily reduce cache hit rate.",
    );
    if (!confirmed) return;

    setIsClearingCache(true);
    try {
      const accessToken = await ensureAccessToken();
      const response = await fetch("/api/v2/cache/clear", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      const payloadText = await response.text().catch(() => "");
      if (!response.ok) {
        showToast(
          `Cache clear failed (${response.status})${
            payloadText ? `: ${payloadText.slice(0, 120)}` : ""
          }`,
          "error",
        );
        return;
      }
      showToast("Upstream caches cleared", "success");
      await refreshDiagnostics();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Cache clear failed",
        "error",
      );
    } finally {
      setIsClearingCache(false);
    }
  }, [refreshDiagnostics, showToast]);

  const refreshOAuthDump = useCallback(
    async (clear = false) => {
      setIsOAuthDumpLoading(true);
      try {
        const params = new URLSearchParams({
          fetchLimit: "240",
          logLimit: "240",
        });
        if (clear) {
          params.set("clear", "1");
        }

        const response = await fetch(
          `/api/admin/auth/fetch-dump?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );
        const payload = (await response.json()) as OAuthDumpResponse;
        if (!response.ok || !payload.ok) {
          showToast(
            payload.error ?? `OAuth dump request failed (${response.status})`,
            "error",
          );
          return;
        }
        setOauthDump(payload);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Failed to fetch OAuth dump",
          "error",
        );
      } finally {
        setIsOAuthDumpLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    upstreamOAuthTraceIdRef.current = upstreamOAuthTraceIdInput;
  }, [upstreamOAuthTraceIdInput]);

  useEffect(() => {
    upstreamOAuthLimitRef.current = upstreamOAuthLimitInput;
  }, [upstreamOAuthLimitInput]);

  const refreshUpstreamOAuthDump = useCallback(async () => {
    setIsUpstreamOAuthDumpLoading(true);
    try {
      const traceId = upstreamOAuthTraceIdRef.current.trim();
      const normalizedLimit = parseBoundedInt(
        upstreamOAuthLimitRef.current,
        200,
        1,
        2000,
      );
      if (String(normalizedLimit) !== upstreamOAuthLimitRef.current) {
        setUpstreamOAuthLimitInput(String(normalizedLimit));
      }

      const params = new URLSearchParams({ limit: String(normalizedLimit) });
      if (traceId.length > 0) {
        params.set("trace_id", traceId);
      }

      const response = await fetch(
        `/api/auth/spotify/debug?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const rawPayload = await response.text().catch(() => "");
      let parsedPayload: unknown = rawPayload;
      if (rawPayload.trim().length === 0) {
        parsedPayload = {};
      } else {
        try {
          parsedPayload = JSON.parse(rawPayload) as unknown;
        } catch {
          parsedPayload = rawPayload;
        }
      }

      setUpstreamOAuthDump({
        status: response.status,
        fetchedAt: new Date().toISOString(),
        traceId: traceId.length > 0 ? traceId : null,
        limit: normalizedLimit,
        payload: parsedPayload,
      });

      if (!response.ok) {
        showToast(
          getErrorMessageFromPayload(parsedPayload) ??
            `Upstream OAuth debug request failed (${response.status})`,
          "error",
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to fetch upstream OAuth debug dump",
        "error",
      );
    } finally {
      setIsUpstreamOAuthDumpLoading(false);
    }
  }, [showToast]);

  const upstreamOAuthEntries = useMemo(
    () => extractUpstreamOAuthDumpEntries(upstreamOAuthDump?.payload),
    [upstreamOAuthDump?.payload],
  );
  const spotifyProfileSummary = useMemo(
    () => extractSpotifyProfileSummary(spotifyProfileData?.payload),
    [spotifyProfileData?.payload],
  );
  const spotifyScopes = useMemo(
    () => normalizeSpotifyScopes(spotifyProfileSummary.scopeText),
    [spotifyProfileSummary.scopeText],
  );
  const hasSpotifyPlaylistScope = useMemo(
    () => hasAnySpotifyScope(spotifyScopes, SPOTIFY_PLAYLIST_READ_SCOPES),
    [spotifyScopes],
  );
  const isSpotifyProfileOnlySession = useMemo(
    () =>
      hasAllSpotifyScopes(spotifyScopes, BASIC_SPOTIFY_LOGIN_SCOPES) &&
      !hasSpotifyPlaylistScope,
    [hasSpotifyPlaylistScope, spotifyScopes],
  );
  const spotifyPlaylists = useMemo(
    () => extractSpotifyPlaylistSummaries(spotifyPlaylistsData?.payload),
    [spotifyPlaylistsData?.payload],
  );
  const selectedSpotifyPlaylistTracks = useMemo(
    () => extractSpotifyPlaylistTracks(selectedSpotifyPlaylistData?.payload),
    [selectedSpotifyPlaylistData?.payload],
  );
  const selectedSpotifyPlaylistSummary = useMemo(
    () =>
      selectedSpotifyPlaylistId
        ? (spotifyPlaylists.find(
            (playlist) => playlist.id === selectedSpotifyPlaylistId,
          ) ?? null)
        : null,
    [selectedSpotifyPlaylistId, spotifyPlaylists],
  );

  const fetchSpotifyAdminPayload = useCallback(
    async (
      path: string,
      accessToken: string,
    ): Promise<SpotifyAdminFetchResult> => {
      const response = await fetch(path, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
        },
      });
      const rawPayload = await response.text().catch(() => "");
      let parsedPayload: unknown = rawPayload;

      if (rawPayload.trim().length === 0) {
        parsedPayload = {};
      } else {
        try {
          parsedPayload = JSON.parse(rawPayload) as unknown;
        } catch {
          parsedPayload = rawPayload;
        }
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessageFromPayload(parsedPayload) ??
            `${path} failed with status ${response.status}`,
        );
      }

      return {
        status: response.status,
        fetchedAt: new Date().toISOString(),
        payload: parsedPayload,
      };
    },
    [],
  );

  const loadSpotifyPlaylistDetail = useCallback(
    async (
      playlistId: string,
      options?: {
        accessToken?: string;
        silent?: boolean;
      },
    ) => {
      setSelectedSpotifyPlaylistId(playlistId);
      setIsSpotifyPlaylistDetailLoading(true);
      try {
        const accessToken =
          options?.accessToken ?? (await ensureAccessToken()) ?? null;

        if (!accessToken) {
          setSpotifyTokenUnavailable(true);
          setSelectedSpotifyPlaylistData(null);
          return;
        }

        setSpotifyTokenUnavailable(false);
        const detail = await fetchSpotifyAdminPayload(
          `/api/admin/spotify/playlists/${encodeURIComponent(playlistId)}`,
          accessToken,
        );
        setSelectedSpotifyPlaylistData(detail);
      } catch (error) {
        const message = normalizeSpotifyPlaylistAccessError(
          error instanceof Error
            ? error.message
            : "Failed to load Spotify playlist details",
        );
        setSpotifyAdminError(message);
        setSelectedSpotifyPlaylistData(null);
        if (!options?.silent) {
          showToast(message, "error");
        }
      } finally {
        setIsSpotifyPlaylistDetailLoading(false);
      }
    },
    [fetchSpotifyAdminPayload, showToast],
  );

  const refreshSpotifyAdminProfileData = useCallback(async () => {
    setIsSpotifyAdminLoading(true);
    setSpotifyAdminError(null);

    try {
      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        setSpotifyTokenUnavailable(true);
        setSpotifyProfileData(null);
        setSpotifyPlaylistsData(null);
        setSelectedSpotifyPlaylistData(null);
        setSelectedSpotifyPlaylistId(null);
        return;
      }

      setSpotifyTokenUnavailable(false);
      const profileResult = await fetchSpotifyAdminPayload(
        "/api/admin/spotify/auth/status",
        accessToken,
      );
      setSpotifyProfileData(profileResult);
      const profileScopes = normalizeSpotifyScopes(
        extractSpotifyProfileSummary(profileResult.payload).scopeText,
      );
      if (
        profileScopes.length > 0 &&
        !hasAnySpotifyScope(profileScopes, SPOTIFY_PLAYLIST_READ_SCOPES)
      ) {
        setSpotifyPlaylistsData(null);
        setSelectedSpotifyPlaylistId(null);
        setSelectedSpotifyPlaylistData(null);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load Spotify admin data";
      setSpotifyAdminError(message);
      showToast(message, "error");
    } finally {
      setIsSpotifyAdminLoading(false);
    }
  }, [fetchSpotifyAdminPayload, showToast]);

  const loadSpotifyPlaylistData = useCallback(async () => {
    setIsSpotifyPlaylistsLoading(true);
    setSpotifyAdminError(null);

    try {
      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        setSpotifyTokenUnavailable(true);
        setSpotifyPlaylistsData(null);
        setSelectedSpotifyPlaylistData(null);
        setSelectedSpotifyPlaylistId(null);
        return;
      }

      setSpotifyTokenUnavailable(false);
      const playlistsResult = await fetchSpotifyAdminPayload(
        "/api/admin/spotify/playlists?limit=24",
        accessToken,
      );

      setSpotifyPlaylistsData(playlistsResult);

      const playlists = extractSpotifyPlaylistSummaries(
        playlistsResult.payload,
      );
      const nextPlaylistId =
        selectedSpotifyPlaylistId &&
        playlists.some((playlist) => playlist.id === selectedSpotifyPlaylistId)
          ? selectedSpotifyPlaylistId
          : (playlists[0]?.id ?? null);

      if (!nextPlaylistId) {
        setSelectedSpotifyPlaylistId(null);
        setSelectedSpotifyPlaylistData(null);
        return;
      }

      await loadSpotifyPlaylistDetail(nextPlaylistId, {
        accessToken,
        silent: true,
      });
    } catch (error) {
      const message = normalizeSpotifyPlaylistAccessError(
        error instanceof Error
          ? error.message
          : "Failed to load Spotify playlist data",
      );
      setSpotifyAdminError(message);
      setSpotifyPlaylistsData(null);
      setSelectedSpotifyPlaylistData(null);
      setSelectedSpotifyPlaylistId(null);
      showToast(message, "error");
    } finally {
      setIsSpotifyPlaylistsLoading(false);
    }
  }, [
    fetchSpotifyAdminPayload,
    loadSpotifyPlaylistDetail,
    selectedSpotifyPlaylistId,
    showToast,
  ]);

  useEffect(() => {
    if (!isAuthorized) return;

    void refreshDiagnostics();
    void refreshOAuthDump();
    void refreshUpstreamOAuthDump();
    void refreshSpotifyAdminProfileData();
    const intervalId = window.setInterval(() => {
      void refreshDiagnostics();
      void refreshOAuthDump();
      void refreshUpstreamOAuthDump();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    isAuthorized,
    refreshDiagnostics,
    refreshOAuthDump,
    refreshSpotifyAdminProfileData,
    refreshUpstreamOAuthDump,
  ]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-[var(--color-surface)]/60" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface)]/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-6 py-8 shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(244,178,102,0.08)] text-[var(--color-accent)]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Admin access required
          </h1>
          <p className="mt-2 text-[var(--color-subtext)]">
            You need to be an admin to view and manage users. If you think this
            is a mistake, sign out and back in.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Return home
            </Link>
            <Link
              href="/signin?callbackUrl=%2Fadmin"
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-3 text-sm tracking-[0.2em] text-[var(--color-subtext)] uppercase">
            <Shield className="h-5 w-5 text-[var(--color-accent)]" />
            Admin Console
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">
            Diagnostics and Users
          </h1>
          <p className="mt-1 text-[var(--color-subtext)]">
            View users, inspect profiles, manage access, and remove accounts.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Refresh users
        </button>
      </div>

      <div className="mb-8 rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/85 to-[rgba(121,195,238,0.1)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <Activity className="h-4 w-4 text-[var(--color-accent)]" />
              API Diagnostics
            </p>
            <p className="mt-1 text-sm text-[var(--color-subtext)]">
              Lightweight checks run every 60s. Heavy endpoints are available as
              links.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void refreshDiagnostics()}
              disabled={isDiagnosticsLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {isDiagnosticsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh diagnostics
            </button>
            <button
              onClick={() => void handleRefreshUpstreamAuth()}
              disabled={isRefreshingUpstreamAuth}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(88,198,177,0.35)] bg-[rgba(88,198,177,0.08)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] disabled:opacity-50"
            >
              {isRefreshingUpstreamAuth ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gauge className="h-4 w-4" />
              )}
              Refresh auth
            </button>
            <button
              onClick={() => void handleClearCaches()}
              disabled={isClearingCache}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/70 bg-[rgba(242,139,130,0.08)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(242,139,130,0.14)] disabled:opacity-50"
            >
              {isClearingCache ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear cache
            </button>
            <a
              href="/api/v2/docs/openapi"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <FileText className="h-4 w-4" />
              OpenAPI
            </a>
            <a
              href="/api/v2/metrics"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <BarChart3 className="h-4 w-4" />
              Metrics
            </a>
          </div>
        </div>

        {diagnosticResults.length === 0 && isDiagnosticsLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl bg-[var(--color-surface)]/70"
              />
            ))}
          </div>
        ) : diagnosticResults.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-subtext)]">
            <CircleAlert className="h-4 w-4 text-[var(--color-warning)]" />
            Diagnostics not available yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {diagnosticResults.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {item.label}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${
                      item.state === "healthy"
                        ? "bg-[rgba(88,198,177,0.15)] text-[var(--color-success)]"
                        : item.state === "degraded"
                          ? "bg-[rgba(242,199,97,0.15)] text-[var(--color-warning)]"
                          : "bg-[rgba(242,139,130,0.15)] text-[var(--color-danger)]"
                    }`}
                  >
                    {item.state === "healthy" ? (
                      <CircleCheck className="h-3 w-3" />
                    ) : (
                      <CircleAlert className="h-3 w-3" />
                    )}
                    {item.status ?? "ERR"}
                  </span>
                </div>
                <p className="mb-2 truncate font-mono text-[10px] text-[var(--color-muted)]">
                  {item.path}
                </p>
                <pre className="max-h-28 overflow-auto rounded-lg bg-[var(--color-surface-2)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                  {item.error
                    ? `${item.error}\n${item.payloadPreview}`
                    : item.payloadPreview}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8 rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/85 to-[rgba(141,173,255,0.08)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
              OAuth Fetch Dump
            </p>
            <p className="mt-1 text-sm text-[var(--color-subtext)]">
              Verbose Spotify/Discord OAuth trace buffer rendered from server
              memory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void refreshOAuthDump()}
              disabled={isOAuthDumpLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {isOAuthDumpLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh dump
            </button>
            <button
              onClick={() => void refreshOAuthDump(true)}
              disabled={isOAuthDumpLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/60 bg-[rgba(242,139,130,0.08)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(242,139,130,0.14)] disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear + refresh
            </button>
          </div>
        </div>

        {oauthDump ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtext)]">
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                verbose oauth debug:{" "}
                <strong className="text-[var(--color-text)]">
                  {oauthDump.oauthVerboseDebugEnabled ? "enabled" : "disabled"}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                fetch entries:{" "}
                <strong className="text-[var(--color-text)]">
                  {oauthDump.fetchDumpCount ?? oauthDump.fetchDump?.length ?? 0}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                auth logs:{" "}
                <strong className="text-[var(--color-text)]">
                  {oauthDump.authLogCount ?? oauthDump.authLogs?.length ?? 0}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                updated:{" "}
                <strong className="text-[var(--color-text)]">
                  {oauthDump.fetchedAt ?? "n/a"}
                </strong>
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  Fetch events
                </p>
                <div className="max-h-80 space-y-2 overflow-auto pr-1">
                  {(oauthDump.fetchDump ?? []).length === 0 ? (
                    <p className="text-xs text-[var(--color-subtext)]">
                      No fetch entries captured yet.
                    </p>
                  ) : (
                    (oauthDump.fetchDump ?? []).map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${entry.label}-${index}`}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--color-text)]">
                            {entry.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              entry.phase === "response"
                                ? "bg-[rgba(88,198,177,0.18)] text-[var(--color-success)]"
                                : entry.phase === "request"
                                  ? "bg-[rgba(121,195,238,0.18)] text-[var(--color-accent)]"
                                  : "bg-[rgba(242,139,130,0.18)] text-[var(--color-danger)]"
                            }`}
                          >
                            {entry.phase}
                          </span>
                        </div>
                        <p className="mb-1 text-[10px] text-[var(--color-muted)]">
                          {entry.timestamp}
                        </p>
                        <pre className="max-h-36 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                          {toJsonPreview(entry.details ?? {})}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  Auth logs
                </p>
                <div className="max-h-80 space-y-2 overflow-auto pr-1">
                  {(oauthDump.authLogs ?? []).length === 0 ? (
                    <p className="text-xs text-[var(--color-subtext)]">
                      No auth log entries captured yet.
                    </p>
                  ) : (
                    (oauthDump.authLogs ?? []).map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${entry.level}-${index}`}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--color-text)]">
                            {entry.message}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              entry.level === "error"
                                ? "bg-[rgba(242,139,130,0.18)] text-[var(--color-danger)]"
                                : entry.level === "warn"
                                  ? "bg-[rgba(242,199,97,0.18)] text-[var(--color-warning)]"
                                  : entry.level === "info"
                                    ? "bg-[rgba(121,195,238,0.18)] text-[var(--color-accent)]"
                                    : "bg-[var(--color-surface)] text-[var(--color-subtext)]"
                            }`}
                          >
                            {entry.level}
                          </span>
                        </div>
                        <p className="mb-1 text-[10px] text-[var(--color-muted)]">
                          {entry.timestamp}
                        </p>
                        <pre className="max-h-36 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                          {toJsonPreview(entry.details ?? {})}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-subtext)]">
            OAuth dump not loaded yet.
          </div>
        )}
      </div>

      <div className="mb-8 rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/85 to-[rgba(88,198,177,0.1)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
              Upstream OAuth2 Dump
            </p>
            <p className="mt-1 text-sm text-[var(--color-subtext)]">
              Proxied from <code>/api/auth/spotify/debug</code> using
              server-side
              <code> AUTH_DEBUG_TOKEN</code>.
            </p>
          </div>
          <button
            onClick={() => void refreshUpstreamOAuthDump()}
            disabled={isUpstreamOAuthDumpLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
          >
            {isUpstreamOAuthDumpLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh upstream dump
          </button>
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_120px]">
          <label className="text-xs text-[var(--color-subtext)]">
            Trace ID (optional)
            <input
              value={upstreamOAuthTraceIdInput}
              onChange={(event) =>
                setUpstreamOAuthTraceIdInput(event.target.value)
              }
              placeholder="trace-id-from-callback"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <label className="text-xs text-[var(--color-subtext)]">
            Limit
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={upstreamOAuthLimitInput}
              onChange={(event) =>
                setUpstreamOAuthLimitInput(event.target.value)
              }
              placeholder="200"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
        </div>

        {upstreamOAuthDump ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtext)]">
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                status:{" "}
                <strong className="text-[var(--color-text)]">
                  {upstreamOAuthDump.status}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                trace:{" "}
                <strong className="text-[var(--color-text)]">
                  {upstreamOAuthDump.traceId ?? "(none)"}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                limit:{" "}
                <strong className="text-[var(--color-text)]">
                  {upstreamOAuthDump.limit}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                entries:{" "}
                <strong className="text-[var(--color-text)]">
                  {upstreamOAuthEntries.length}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                updated:{" "}
                <strong className="text-[var(--color-text)]">
                  {upstreamOAuthDump.fetchedAt}
                </strong>
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  Parsed events
                </p>
                <div className="max-h-80 space-y-2 overflow-auto pr-1">
                  {upstreamOAuthEntries.length === 0 ? (
                    <p className="text-xs text-[var(--color-subtext)]">
                      No list-like event collection detected in response.
                    </p>
                  ) : (
                    upstreamOAuthEntries.map((entry, index) => (
                      <div
                        key={`${entry.timestamp ?? "no-ts"}-${entry.title}-${index}`}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--color-text)]">
                            {entry.title}
                          </span>
                          <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-subtext)] uppercase">
                            {entry.level ?? "event"}
                          </span>
                        </div>
                        <p className="mb-1 text-[10px] text-[var(--color-muted)]">
                          {entry.timestamp ?? "timestamp unavailable"}
                        </p>
                        <pre className="max-h-36 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                          {toJsonPreview(entry.details)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  Raw response
                </p>
                <pre className="max-h-80 overflow-auto rounded-lg bg-[var(--color-surface-2)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                  {toJsonPreview(upstreamOAuthDump.payload)}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-subtext)]">
            Upstream OAuth debug dump not loaded yet.
          </div>
        )}
      </div>

      <div className="mb-8 rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/85 to-[rgba(29,185,84,0.12)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <Gauge className="h-4 w-4 text-[var(--color-accent)]" />
              Spotify Admin Data
            </p>
            <p className="mt-1 text-sm text-[var(--color-subtext)]">
              Basic Spotify login now exposes connection and profile data by
              default. Playlist data is optional and should be treated as a
              separate elevated-consent capability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void refreshSpotifyAdminProfileData()}
              disabled={isSpotifyAdminLoading}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {isSpotifyAdminLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh Spotify profile
            </button>
            <button
              onClick={() => void loadSpotifyPlaylistData()}
              disabled={
                isSpotifyPlaylistsLoading ||
                isSpotifyPlaylistDetailLoading ||
                spotifyTokenUnavailable
              }
              className="inline-flex items-center gap-2 self-start rounded-xl border border-[rgba(29,185,84,0.28)] bg-[rgba(29,185,84,0.12)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[#1DB954] hover:text-[#1DB954] disabled:opacity-50"
            >
              {isSpotifyPlaylistsLoading || isSpotifyPlaylistDetailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {spotifyPlaylistsData
                ? "Refresh playlist data"
                : "Load playlist data"}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-[rgba(121,195,238,0.22)] bg-[rgba(121,195,238,0.08)] px-4 py-3 text-sm text-[var(--color-subtext)]">
          Basic login should now only grant{" "}
          <code className="rounded bg-[var(--color-surface)] px-1 py-0.5 text-[11px] text-[var(--color-text)]">
            user-read-email
          </code>{" "}
          and{" "}
          <code className="rounded bg-[var(--color-surface)] px-1 py-0.5 text-[11px] text-[var(--color-text)]">
            user-read-private
          </code>
          . This dashboard always loads profile data first and only attempts
          playlist endpoints when requested explicitly.
        </div>

        {spotifyTokenUnavailable &&
        !spotifyProfileData &&
        !spotifyPlaylistsData ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-subtext)]">
            No Spotify app token is available in this browser session. Sign in
            through Spotify first if you want admin-side Spotify data to appear
            here.
          </div>
        ) : !spotifyProfileData &&
          !spotifyPlaylistsData &&
          isSpotifyAdminLoading ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-2xl bg-[var(--color-surface)]/70"
              />
            ))}
          </div>
        ) : spotifyAdminError &&
          !spotifyProfileData &&
          !spotifyPlaylistsData ? (
          <div className="rounded-2xl border border-[rgba(242,139,130,0.25)] bg-[rgba(242,139,130,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {spotifyAdminError}
          </div>
        ) : (
          <>
            {spotifyAdminError ? (
              <div className="mb-3 rounded-2xl border border-[rgba(242,139,130,0.25)] bg-[rgba(242,139,130,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {spotifyAdminError}
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtext)]">
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                connected:{" "}
                <strong className="text-[var(--color-text)]">
                  {spotifyProfileSummary.connected === null
                    ? "unknown"
                    : spotifyProfileSummary.connected
                      ? "yes"
                      : "no"}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                playlist access:{" "}
                <strong className="text-[var(--color-text)]">
                  {hasSpotifyPlaylistScope
                    ? "granted"
                    : isSpotifyProfileOnlySession
                      ? "profile only"
                      : spotifyScopes.length > 0
                        ? "not granted"
                        : "unknown"}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                playlists loaded:{" "}
                <strong className="text-[var(--color-text)]">
                  {spotifyPlaylists.length}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                selected tracks:{" "}
                <strong className="text-[var(--color-text)]">
                  {selectedSpotifyPlaylistTracks.length}
                </strong>
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                updated:{" "}
                <strong className="text-[var(--color-text)]">
                  {spotifyProfileData?.fetchedAt ?? "n/a"}
                </strong>
              </span>
            </div>

            <div className="grid gap-3 xl:grid-cols-[320px_320px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
                <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                  Profile
                </p>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    {spotifyProfileSummary.imageUrl ? (
                      <Image
                        src={spotifyProfileSummary.imageUrl}
                        alt={
                          spotifyProfileSummary.displayName ?? "Spotify profile"
                        }
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Gauge className="h-5 w-5 text-[var(--color-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[var(--color-text)]">
                      {spotifyProfileSummary.displayName ?? "Spotify user"}
                    </p>
                    {spotifyProfileSummary.email ? (
                      <p className="truncate text-sm text-[var(--color-subtext)]">
                        {spotifyProfileSummary.email}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      Spotify ID: {spotifyProfileSummary.spotifyUserId ?? "n/a"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-[var(--color-subtext)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Country</span>
                    <strong className="text-[var(--color-text)]">
                      {spotifyProfileSummary.country ?? "n/a"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Plan</span>
                    <strong className="text-[var(--color-text)]">
                      {spotifyProfileSummary.product ?? "n/a"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Followers</span>
                    <strong className="text-[var(--color-text)]">
                      {spotifyProfileSummary.followerCount ?? "n/a"}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-[var(--color-surface-2)]/70 p-3">
                  <p className="mb-1 text-xs font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">
                    Scopes
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--color-subtext)]">
                    {spotifyProfileSummary.scopeText ??
                      "No scope metadata returned."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
                <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                  Playlist Data
                </p>
                <p className="mb-3 text-xs leading-relaxed text-[var(--color-subtext)]">
                  Basic Spotify login should not be treated as playlist consent.
                  Use the button above only when testing an elevated-consent or
                  legacy-scope session.
                </p>
                <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                  {!spotifyPlaylistsData && isSpotifyPlaylistsLoading ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                    </div>
                  ) : spotifyPlaylists.length === 0 ? (
                    <p className="text-sm text-[var(--color-subtext)]">
                      {hasSpotifyPlaylistScope
                        ? "No Spotify playlists were returned for this session."
                        : "Playlist data has not been loaded. Under the narrowed backend OAuth flow, this should be considered a separate elevated-consent path."}
                    </p>
                  ) : (
                    spotifyPlaylists.map((playlist) => {
                      const isSelected =
                        playlist.id === selectedSpotifyPlaylistId;

                      return (
                        <button
                          key={playlist.id}
                          type="button"
                          onClick={() =>
                            void loadSpotifyPlaylistDetail(playlist.id)
                          }
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-[var(--color-accent)] bg-[rgba(121,195,238,0.12)]"
                              : "border-[var(--color-border)] bg-[var(--color-surface-2)]/70 hover:border-[var(--color-accent)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                              {playlist.imageUrl ? (
                                <Image
                                  src={playlist.imageUrl}
                                  alt={playlist.name}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FileText className="h-4 w-4 text-[var(--color-muted)]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                {playlist.name}
                              </p>
                              <p className="truncate text-xs text-[var(--color-subtext)]">
                                {playlist.ownerName ?? "Unknown owner"}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                                {playlist.trackCount ?? "?"} tracks
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {selectedSpotifyPlaylistSummary?.name ?? "Playlist Detail"}
                  </p>
                  {selectedSpotifyPlaylistSummary?.externalUrl ? (
                    <a
                      href={selectedSpotifyPlaylistSummary.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-light)]"
                    >
                      <Link2 className="h-3 w-3" />
                      Open in Spotify
                    </a>
                  ) : null}
                </div>

                {selectedSpotifyPlaylistId === null ? (
                  <p className="text-sm text-[var(--color-subtext)]">
                    Playlist detail is only available after loading playlist
                    data explicitly.
                  </p>
                ) : isSpotifyPlaylistDetailLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
                  </div>
                ) : (
                  <>
                    {selectedSpotifyPlaylistSummary?.description ? (
                      <p className="mb-3 text-sm text-[var(--color-subtext)]">
                        {selectedSpotifyPlaylistSummary.description}
                      </p>
                    ) : null}

                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtext)]">
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                        owner:{" "}
                        <strong className="text-[var(--color-text)]">
                          {selectedSpotifyPlaylistSummary?.ownerName ?? "n/a"}
                        </strong>
                      </span>
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
                        tracks:{" "}
                        <strong className="text-[var(--color-text)]">
                          {selectedSpotifyPlaylistTracks.length}
                        </strong>
                      </span>
                    </div>

                    <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                      {selectedSpotifyPlaylistTracks.length === 0 ? (
                        <p className="text-sm text-[var(--color-subtext)]">
                          No track-level Spotify metadata was returned for this
                          playlist.
                        </p>
                      ) : (
                        selectedSpotifyPlaylistTracks.map((track, index) => (
                          <div
                            key={`${track.id ?? "track"}-${index}`}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                                {track.imageUrl ? (
                                  <Image
                                    src={track.imageUrl}
                                    alt={track.name}
                                    width={48}
                                    height={48}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <FileText className="h-4 w-4 text-[var(--color-muted)]" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                      {track.name}
                                    </p>
                                    <p className="truncate text-xs text-[var(--color-subtext)]">
                                      {track.artists.length > 0
                                        ? track.artists.join(", ")
                                        : "Unknown artist"}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                                    {formatDurationMs(track.durationMs)}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">
                                  Album: {track.albumName ?? "n/a"}
                                </p>
                                {track.externalUrl ? (
                                  <a
                                    href={track.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-light)]"
                                  >
                                    <Link2 className="h-3 w-3" />
                                    Open track
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <details className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text)]">
                Raw Spotify payloads
              </summary>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3">
                  <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">
                    Auth status
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                    {toJsonPreview(spotifyProfileData?.payload ?? {})}
                  </pre>
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3">
                  <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">
                    Playlists (optional)
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                    {spotifyPlaylistsData
                      ? toJsonPreview(spotifyPlaylistsData.payload)
                      : "Not loaded. Basic Spotify login is profile-only by default."}
                  </pre>
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3">
                  <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-muted)] uppercase">
                    Selected playlist (optional)
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--color-surface)]/70 p-2 text-[10px] leading-relaxed text-[var(--color-subtext)]">
                    {selectedSpotifyPlaylistData
                      ? toJsonPreview(selectedSpotifyPlaylistData.payload)
                      : "Not loaded. Load playlist data first if you are testing elevated Spotify consent."}
                  </pre>
                </div>
              </div>
            </details>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/90 to-[rgba(88,198,177,0.08)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[var(--color-subtext)]">
            <Users2 className="h-5 w-5" />
            <span className="text-sm">
              {users?.length ?? 0} user{(users?.length ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
          {error && (
            <div className="text-sm text-[var(--color-danger)]">
              {error.message}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface)]/70"
              />
            ))}
          </div>
        ) : (users?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center">
            <Users2 className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-[var(--color-subtext)]">No users found.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 transition hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? "User avatar"}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Shield className="h-5 w-5 text-[var(--color-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-lg font-semibold text-[var(--color-text)]">
                        {user.name ?? "Unnamed user"}
                      </p>
                      {user.admin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(88,198,177,0.12)] px-2 py-1 text-xs font-semibold text-[var(--color-success)]">
                          <Crown className="h-3 w-3" />
                          {user.firstAdmin ? "First Admin" : "Admin"}
                        </span>
                      )}
                      {!user.profilePublic && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(242,199,97,0.12)] px-2 py-1 text-xs font-semibold text-[var(--color-warning)]">
                          <Lock className="h-3 w-3" />
                          Private
                        </span>
                      )}
                      {user.banned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(242,139,130,0.2)] px-2 py-1 text-xs font-semibold text-[var(--color-danger)]">
                          <Ban className="h-3 w-3" />
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-[var(--color-subtext)]">
                      {user.email}
                    </p>
                    {user.userHash && (
                      <Link
                        href={`/${user.userHash}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-light)]"
                      >
                        <Link2 className="h-3 w-3" />
                        View profile
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-xs tracking-[0.12em] text-[var(--color-muted)] uppercase">
                    ID: {user.id}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        handleToggleAdmin(user.id, user.admin ?? false)
                      }
                      disabled={
                        updateAdmin.isPending ||
                        user.firstAdmin ||
                        ((user.admin ?? false) && !isFirstAdmin)
                      }
                      title={
                        user.firstAdmin
                          ? "The first admin cannot be demoted by other admins."
                          : (user.admin ?? false) && !isFirstAdmin
                            ? "Only the first admin can remove admin access from admins."
                            : ""
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        user.admin
                          ? "border border-[var(--color-danger)]/70 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                          : "border border-[var(--color-accent)]/70 text-[var(--color-text)] hover:bg-[var(--color-accent)]/10"
                      } ${updateAdmin.isPending || user.firstAdmin || ((user.admin ?? false) && !isFirstAdmin) ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {updateAdmin.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : user.admin ? (
                        <>
                          <Shield className="h-4 w-4" />
                          {user.firstAdmin ? "Protected" : "Remove admin"}
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 text-[var(--color-accent)]" />
                          Grant admin
                        </>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        handleToggleBanned(user.id, user.banned ?? false)
                      }
                      disabled={
                        updateBanned.isPending ||
                        removeUser.isPending ||
                        ((user.admin ?? false) && !isFirstAdmin) ||
                        session?.user?.id === user.id
                      }
                      title={
                        session?.user?.id === user.id
                          ? "You cannot ban yourself."
                          : (user.admin ?? false) && !isFirstAdmin
                            ? "Only the first admin can ban or unban other admins."
                            : ""
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        user.banned
                          ? "border border-[var(--color-success)]/70 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                          : "border border-[var(--color-danger)]/70 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                      } ${updateBanned.isPending || ((user.admin ?? false) && !isFirstAdmin) ? "opacity-50" : ""} ${session?.user?.id === user.id ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {updateBanned.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : user.banned ? (
                        <>
                          <CircleCheck className="h-4 w-4" />
                          Unban
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4" />
                          Ban
                        </>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        handleRemoveUser(
                          user.id,
                          user.name ?? user.email ?? "this user",
                        )
                      }
                      disabled={
                        removeUser.isPending ||
                        updateBanned.isPending ||
                        updateAdmin.isPending ||
                        ((user.admin ?? false) && !isFirstAdmin) ||
                        session?.user?.id === user.id
                      }
                      title={
                        session?.user?.id === user.id
                          ? "You cannot remove your own account from the admin panel."
                          : (user.admin ?? false) && !isFirstAdmin
                            ? "Only the first admin can remove other admins."
                            : ""
                      }
                      className={`inline-flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/70 px-3 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10 ${
                        removeUser.isPending ||
                        ((user.admin ?? false) && !isFirstAdmin)
                          ? "opacity-50"
                          : ""
                      } ${session?.user?.id === user.id ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {removeUser.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserX className="h-4 w-4" />
                          Remove user
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
