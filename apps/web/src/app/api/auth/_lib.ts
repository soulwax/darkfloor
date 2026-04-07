// File: apps/web/src/app/api/auth/_lib.ts

import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { type NextRequest, NextResponse } from "next/server";
import {
  logAuthDebug,
  recordAuthFetchDumpEvent,
  summarizeUrlForLog,
} from "@starchild/auth";

const AUTH_PROXY_TIMEOUT_MS = 10_000;
const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "is-electron",
  "origin",
  "referer",
  "user-agent",
  "x-correlation-id",
  "x-csrf-token",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-request-id",
]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  "cache-control",
  "content-type",
  "location",
  "retry-after",
  "x-correlation-id",
  "x-request-id",
]);

type ProxyAuthOptions = {
  pathname: string;
  request: NextRequest | Request;
  method?: string;
  followRedirects?: boolean;
  upstreamHeaders?: HeadersInit;
};

function summarizeHeaderKeys(headers: Headers): string[] {
  return Array.from(headers.keys()).sort();
}

function summarizeSetCookieNames(headers: Headers): string[] {
  const raw = headers.get("set-cookie");
  if (!raw) return [];

  return raw
    .split(/,(?=\s*[^;,=\s]+=)/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [firstPart] = cookie.split(";");
      const [name] = (firstPart ?? "").split("=");
      return (name ?? "").trim();
    })
    .filter(Boolean);
}

function getRequestUrl(request: NextRequest | Request): URL {
  if ("nextUrl" in request && request.nextUrl instanceof URL) {
    return request.nextUrl;
  }
  return new URL(request.url);
}

function getForwardHeaders(request: NextRequest | Request): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!REQUEST_HEADER_ALLOWLIST.has(normalized)) return;
    headers.set(normalized, value);
  });

  const requestUrl = getRequestUrl(request);
  if (!headers.has("x-forwarded-host")) {
    headers.set("x-forwarded-host", requestUrl.host);
  }
  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));
  }
  if (!headers.has("is-electron")) {
    const userAgent = request.headers.get("user-agent") ?? "";
    if (/\belectron\//i.test(userAgent)) {
      headers.set("is-electron", "true");
    }
  }

  return headers;
}

function splitSetCookieHeader(value: string): string[] {
  return value
    .split(/,(?=\s*[^;,=\s]+=)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie().filter(Boolean);
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return splitSetCookieHeader(raw);
}

function mapResponseHeaders(response: Response): Headers {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!RESPONSE_HEADER_ALLOWLIST.has(normalized)) return;
    headers.set(normalized, value);
  });

  for (const cookie of getSetCookieHeaders(response.headers)) {
    headers.append("set-cookie", cookie);
  }

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return headers;
}

export async function proxyAuthRequest(options: ProxyAuthOptions): Promise<NextResponse> {
  if (getApiV2BaseUrls().length === 0) {
    return NextResponse.json(
      { ok: false, error: "API_V2_URL is not configured" },
      { status: 500 },
    );
  }

  const method = options.method ?? options.request.method ?? "GET";
  const headers = getForwardHeaders(options.request);
  if (options.upstreamHeaders) {
    const extraHeaders = new Headers(options.upstreamHeaders);
    extraHeaders.forEach((value, key) => {
      headers.set(key.toLowerCase(), value);
    });
  }
  let body: string | undefined;

  if (method !== "GET" && method !== "HEAD") {
    body = await options.request.text();
    if (!body) {
      body = undefined;
      headers.delete("content-type");
    }
  } else {
    headers.delete("content-type");
  }

  const requestUrl = getRequestUrl(options.request);
  const requestStart = Date.now();

  recordAuthFetchDumpEvent({
    label: options.pathname,
    phase: "request",
    details: {
      method,
      followRedirects: Boolean(options.followRedirects),
      incomingUrl: summarizeUrlForLog(requestUrl.toString()),
      upstreamPath: options.pathname,
      upstreamTargetCount: getApiV2BaseUrls().length,
      hasBody: Boolean(body),
      bodyLength: body?.length ?? 0,
      headerKeys: summarizeHeaderKeys(headers),
    },
  });

  try {
    const { response: upstreamResponse } = await fetchApiV2WithFailover({
      pathname: options.pathname,
      request: options.request,
      timeoutMs: AUTH_PROXY_TIMEOUT_MS,
      init: {
        method,
        headers,
        ...(body ? { body } : {}),
        redirect: options.followRedirects ? "follow" : "manual",
        cache: "no-store",
      },
    });

    const elapsedMs = Date.now() - requestStart;
    recordAuthFetchDumpEvent({
      label: options.pathname,
      phase: "response",
      details: {
        method,
        status: upstreamResponse.status,
        elapsedMs,
        redirected: upstreamResponse.redirected,
        responseUrl: summarizeUrlForLog(upstreamResponse.url),
        location: summarizeUrlForLog(upstreamResponse.headers.get("location")),
        setCookieNames: summarizeSetCookieNames(upstreamResponse.headers),
        responseHeaderKeys: summarizeHeaderKeys(upstreamResponse.headers),
      },
    });
    logAuthDebug("OAuth proxy upstream response", {
      pathname: options.pathname,
      method,
      status: upstreamResponse.status,
      elapsedMs,
      redirected: upstreamResponse.redirected,
    });

    const payload = await upstreamResponse.arrayBuffer();

    return new NextResponse(payload, {
      status: upstreamResponse.status,
      headers: mapResponseHeaders(upstreamResponse),
    });
  } catch (error) {
    const elapsedMs = Date.now() - requestStart;
    recordAuthFetchDumpEvent({
      label: options.pathname,
      phase: "error",
      details: {
        method,
        elapsedMs,
        upstreamPath: options.pathname,
        error,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Auth proxy failed",
      },
      { status: 502 },
    );
  }
}
