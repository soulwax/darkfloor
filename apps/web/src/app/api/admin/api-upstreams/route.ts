// File: apps/web/src/app/api/admin/api-upstreams/route.ts

import {
  apiV2UpstreamInternals,
  listConfiguredApiV2Upstreams,
} from "@/lib/server/api-v2-upstream";
import { auth } from "@/server/auth";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM_PROBE_TIMEOUT_MS = 8_000;
const PROBE_PATHS = [
  { key: "status", label: "Liveness", pathname: "/status" },
  { key: "version", label: "Version", pathname: "/version" },
  { key: "ready", label: "Readiness", pathname: "/health/ready" },
] as const;

type ProbeKey = (typeof PROBE_PATHS)[number]["key"];

type UpstreamProbeResult = {
  key: ProbeKey;
  label: string;
  pathname: string;
  status: number | null;
  ok: boolean;
  state: "healthy" | "degraded" | "down";
  payloadPreview: string;
  error?: string;
};

type UpstreamRoutingState = {
  poolWeights: Partial<Record<"default" | "read" | "write" | "stream", number>>;
  cooldownUntil: string | null;
  cooldownRemainingMs: number;
  selectionCount: number;
  selectionCountByPool: Partial<
    Record<"default" | "read" | "write" | "stream", number>
  >;
  successCount: number;
  failureCount: number;
  lastSelectedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
};

function getResultState(
  status: number | null,
): "healthy" | "degraded" | "down" {
  if (status === null) return "down";
  if (status >= 500) return "down";
  if (status >= 400) return "degraded";
  return "healthy";
}

function toPreviewText(rawText: string): string {
  if (!rawText.trim()) return "(empty)";

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const pretty = JSON.stringify(parsed, null, 2);
    if (!pretty) return "(empty)";
    return pretty.length > 400 ? `${pretty.slice(0, 400)}\n...` : pretty;
  } catch {
    return rawText.length > 400 ? `${rawText.slice(0, 400)}\n...` : rawText;
  }
}

async function probeUpstreamPath(
  baseUrl: string,
  path: (typeof PROBE_PATHS)[number],
): Promise<UpstreamProbeResult> {
  const url = new URL(path.pathname, `${baseUrl}/`);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_PROBE_TIMEOUT_MS),
    });
    const rawText = await response.text().catch(() => "");

    return {
      key: path.key,
      label: path.label,
      pathname: path.pathname,
      status: response.status,
      ok: response.ok,
      state: getResultState(response.status),
      payloadPreview: toPreviewText(rawText),
    };
  } catch (error) {
    return {
      key: path.key,
      label: path.label,
      pathname: path.pathname,
      status: null,
      ok: false,
      state: "down",
      payloadPreview: "(no response)",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeUpstreamState(
  probes: UpstreamProbeResult[],
): "healthy" | "degraded" | "down" {
  if (probes.some((probe) => probe.state === "down")) return "down";
  if (probes.some((probe) => probe.state === "degraded")) return "degraded";
  return "healthy";
}

function parseClearFlag(request: NextRequest): boolean {
  const value = request.nextUrl.searchParams.get("clear");
  return ["1", "true", "yes"].includes((value ?? "").toLowerCase());
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.admin) {
    return NextResponse.json(
      { ok: false, error: "Admin access required." },
      { status: 403 },
    );
  }

  const configuredUpstreams = listConfiguredApiV2Upstreams();
  const clearRequested = parseClearFlag(request);

  if (clearRequested) {
    apiV2UpstreamInternals.clearState();
  }

  const stateSnapshot = apiV2UpstreamInternals.getStateSnapshot();
  const now = Date.now();

  const items = await Promise.all(
    configuredUpstreams.map(async (upstream) => {
      const probes = await Promise.all(
        PROBE_PATHS.map((path) => probeUpstreamPath(upstream.url, path)),
      );
      const cooldownUntilMs = stateSnapshot.cooldowns[upstream.url] ?? null;
      const metrics = stateSnapshot.metricsByUrl[upstream.url];
      const routing: UpstreamRoutingState = {
        poolWeights: upstream.poolWeights,
        cooldownUntil:
          typeof cooldownUntilMs === "number"
            ? new Date(cooldownUntilMs).toISOString()
            : null,
        cooldownRemainingMs:
          typeof cooldownUntilMs === "number"
            ? Math.max(0, cooldownUntilMs - now)
            : 0,
        selectionCount: metrics?.selectionCount ?? 0,
        selectionCountByPool: metrics?.selectionCountByPool ?? {},
        successCount: metrics?.successCount ?? 0,
        failureCount: metrics?.failureCount ?? 0,
        lastSelectedAt: metrics?.lastSelectedAt
          ? new Date(metrics.lastSelectedAt).toISOString()
          : null,
        lastSuccessAt: metrics?.lastSuccessAt
          ? new Date(metrics.lastSuccessAt).toISOString()
          : null,
        lastFailureAt: metrics?.lastFailureAt
          ? new Date(metrics.lastFailureAt).toISOString()
          : null,
        lastFailureReason: metrics?.lastFailureReason ?? null,
      };

      return {
        url: upstream.url,
        pools: upstream.pools,
        state: summarizeUpstreamState(probes),
        fetchedAt: new Date().toISOString(),
        routing,
        probes,
      };
    }),
  );

  return NextResponse.json(
    {
      ok: true,
      fetchedAt: new Date().toISOString(),
      count: items.length,
      items,
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
