// File: apps/web/src/app/api/v2/_lib.ts

import { env } from "@/env";
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

function getApiV2BaseUrl(): string | null {
  if (!env.API_V2_URL) return null;
  return env.API_V2_URL.replace(/\/+$/, "");
}

function getRequestUrl(request: NextRequest | Request): URL {
  if ("nextUrl" in request && request.nextUrl instanceof URL) {
    return request.nextUrl;
  }
  return new URL(request.url);
}

function getUpstreamUrl(
  pathname: string,
  request?: NextRequest | Request,
): string | null {
  const baseUrl = getApiV2BaseUrl();
  if (!baseUrl) return null;

  const upstreamUrl = new URL(pathname, `${baseUrl}/`);
  if (request) {
    const requestUrl = getRequestUrl(request);
    for (const [key, value] of requestUrl.searchParams.entries()) {
      upstreamUrl.searchParams.append(key, value);
    }
  }

  return upstreamUrl.toString();
}

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

  const upstreamUrl = getUpstreamUrl(options.pathname, options.request);
  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: "API_V2_URL is not configured" },
      { status: 500 },
    );
  }

  const method = options.method ?? options.request?.method ?? "GET";
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
    const response = await fetch(upstreamUrl, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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
