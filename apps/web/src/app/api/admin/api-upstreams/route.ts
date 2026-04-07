// File: apps/web/src/app/api/admin/api-upstreams/route.ts

import {
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
    // no-op placeholder so the UI can use a single refresh pathway later
  }

  const items = await Promise.all(
    configuredUpstreams.map(async (upstream) => {
      const probes = await Promise.all(
        PROBE_PATHS.map((path) => probeUpstreamPath(upstream.url, path)),
      );

      return {
        url: upstream.url,
        pools: upstream.pools,
        state: summarizeUpstreamState(probes),
        fetchedAt: new Date().toISOString(),
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
