// File: apps/web/src/app/api/admin/api-upstreams/route.ts

import { normalizeClusterDiagnostics } from "@/app/admin/clusterDiagnostics";
import { env } from "@/env";
import { auth } from "@/server/auth";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 8_000;
const DETAILED_CLUSTER_PATHS = [
  "/api/v2/ops/cluster/servers",
  "/ops/cluster/servers",
] as const;
const PUBLIC_CLUSTER_SUMMARY_PATH = "/cluster/sync";
const FORWARDED_HEADER_ALLOWLIST = new Set([
  "accept",
  "authorization",
  "user-agent",
  "x-correlation-id",
  "x-request-id",
]);

type DiagnosticsRouteResponse =
  | {
      ok: true;
      diagnostics: ReturnType<typeof normalizeClusterDiagnostics>;
    }
  | {
      ok: false;
      error: string;
      diagnostics?: ReturnType<typeof normalizeClusterDiagnostics>;
    };

function getApiHubBaseUrl(): string {
  return env.API_HUB_URL;
}

function buildHubRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers({
    accept: "application/json",
  });

  for (const [key, value] of request.headers.entries()) {
    const normalized = key.toLowerCase();
    if (!FORWARDED_HEADER_ALLOWLIST.has(normalized)) continue;
    headers.set(normalized, value);
  }

  const backendApiKey = env.BLUESIX_API_KEY ?? env.UNIVERSAL_KEY;
  if (backendApiKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", backendApiKey);
  }

  return headers;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return await response.text();
}

function toErrorMessage(
  status: number,
  requestedUrl: string,
  payload: unknown,
): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return `Cluster diagnostics request failed (${status}) via ${requestedUrl}: ${payload.trim().slice(0, 200)}`;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const directMessage =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : null;
    if (directMessage) {
      return `Cluster diagnostics request failed (${status}) via ${requestedUrl}: ${directMessage}`;
    }
  }

  return `Cluster diagnostics request failed (${status}) via ${requestedUrl}`;
}

async function fetchClusterPayload(
  request: NextRequest,
  pathnames: readonly string[],
): Promise<
  | {
      ok: true;
      requestedUrl: string;
      payload: unknown;
    }
  | {
      ok: false;
      requestedUrl: string;
      status: number;
      payload: unknown;
    }
> {
  const baseUrl = getApiHubBaseUrl();
  const headers = buildHubRequestHeaders(request);
  let lastFailure:
    | {
        requestedUrl: string;
        status: number;
        payload: unknown;
      }
    | undefined;

  for (const pathname of pathnames) {
    const requestedUrl = new URL(pathname, `${baseUrl}/`).toString();

    try {
      const response = await fetch(requestedUrl, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await parseResponsePayload(response);

      if (response.ok) {
        return {
          ok: true,
          requestedUrl,
          payload,
        };
      }

      lastFailure = {
        requestedUrl,
        status: response.status,
        payload,
      };

      if (response.status !== 404) {
        return {
          ok: false,
          ...lastFailure,
        };
      }
    } catch (error) {
      return {
        ok: false,
        requestedUrl,
        status: 502,
        payload: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    ok: false,
    requestedUrl:
      lastFailure?.requestedUrl ??
      new URL(pathnames[0] ?? "/", `${baseUrl}/`).toString(),
    status: lastFailure?.status ?? 404,
    payload: lastFailure?.payload ?? "Cluster diagnostics route not found",
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.admin) {
    return NextResponse.json<DiagnosticsRouteResponse>(
      { ok: false, error: "Admin access required." },
      { status: 403 },
    );
  }

  const detailedResult = await fetchClusterPayload(request, DETAILED_CLUSTER_PATHS);
  if (detailedResult.ok) {
    return NextResponse.json<DiagnosticsRouteResponse>(
      {
        ok: true,
        diagnostics: normalizeClusterDiagnostics(
          detailedResult.payload,
          getApiHubBaseUrl(),
        ),
      },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  const summaryResult = await fetchClusterPayload(request, [PUBLIC_CLUSTER_SUMMARY_PATH]);
  if (summaryResult.ok) {
    return NextResponse.json<DiagnosticsRouteResponse>(
      {
        ok: false,
        error: toErrorMessage(
          detailedResult.status,
          detailedResult.requestedUrl,
          detailedResult.payload,
        ),
        diagnostics: normalizeClusterDiagnostics(
          summaryResult.payload,
          getApiHubBaseUrl(),
        ),
      },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  return NextResponse.json<DiagnosticsRouteResponse>(
    {
      ok: false,
      error: toErrorMessage(
        detailedResult.status,
        detailedResult.requestedUrl,
        detailedResult.payload,
      ),
    },
    {
      status: detailedResult.status >= 400 ? detailedResult.status : 502,
      headers: { "cache-control": "no-store" },
    },
  );
}
