// File: apps/web/src/app/api/v2/_lib.ts

import { env } from "@/env";
import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { type NextRequest, NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 8000;
const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "authorization",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "user-agent",
  "x-request-id",
  "x-correlation-id",
]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
  "link",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
  "retry-after",
  "x-correlation-id",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-request-id",
]);

type ProxyApiV2Options = {
  pathname: string;
  request?: NextRequest | Request;
  method?: string;
  timeoutMs?: number;
  requireAdmin?: boolean;
};

function getForwardHeaders(request?: NextRequest | Request): Headers {
  const headers = new Headers();

  if (request) {
    for (const [key, value] of request.headers.entries()) {
      const normalized = key.toLowerCase();
      if (!REQUEST_HEADER_ALLOWLIST.has(normalized)) continue;
      headers.set(normalized, value);
    }
  }

  const backendApiKey = env.BLUESIX_API_KEY ?? env.UNIVERSAL_KEY;
  if (backendApiKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", backendApiKey);
  }

  return headers;
}

function getResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of response.headers.entries()) {
    const normalized = key.toLowerCase();
    if (!RESPONSE_HEADER_ALLOWLIST.has(normalized)) continue;
    headers.set(normalized, value);
  }

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return headers;
}

export async function proxyApiV2(
  options: ProxyApiV2Options,
): Promise<NextResponse> {
  const method = options.method ?? options.request?.method ?? "GET";
  const pool =
    method === "GET" || method === "HEAD" || method === "OPTIONS"
      ? "read"
      : "write";

  if (options.requireAdmin) {
    const { auth } = await import("@/server/auth");
    const session = await auth();
    if (!session?.user?.admin) {
      return NextResponse.json(
        { ok: false, error: "Admin access required" },
        { status: 403 },
      );
    }
  }

  if (getApiV2BaseUrls(pool).length === 0) {
    return NextResponse.json(
      { ok: false, error: "API_V2_URL is not configured" },
      { status: 500 },
    );
  }

  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const headers = getForwardHeaders(options.request);
  let body: string | undefined;

  if (options.request && method !== "GET" && method !== "HEAD") {
    body = await options.request.text();
    if (!body) {
      body = undefined;
      headers.delete("content-type");
    }
  } else {
    headers.delete("content-type");
  }

  try {
    const { response } = await fetchApiV2WithFailover({
      pathname: options.pathname,
      pool,
      request: options.request,
      timeoutMs,
      init: {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        cache: "no-store",
      },
    });
    const payload = await response.arrayBuffer();

    return new NextResponse(payload, {
      status: response.status,
      headers: getResponseHeaders(response),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Upstream fetch failed",
      },
      { status: 502 },
    );
  }
}

export async function proxyApiV2StatusLike(
  pathname: string,
  request?: NextRequest | Request,
): Promise<NextResponse> {
  return proxyApiV2({
    pathname,
    request,
  });
}
