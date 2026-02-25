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

  useEffect(() => {
    if (!isAuthorized) return;

    void refreshDiagnostics();
    void refreshOAuthDump();
    void refreshUpstreamOAuthDump();
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
