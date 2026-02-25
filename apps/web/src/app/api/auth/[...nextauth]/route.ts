// File: apps/web/src/app/api/auth/[...nextauth]/route.ts

import { type NextRequest } from "next/server";

import { handlers } from "@/server/auth";
import {
  hashForLog,
  isOAuthVerboseDebugEnabled,
  logAuthDebug,
  logAuthError,
  recordAuthFetchDumpEvent,
  summarizeUrlForLog,
} from "@starchild/auth";

const oauthVerboseDebugEnabled = isOAuthVerboseDebugEnabled();

function parseAuthRoute(pathname: string): {
  action: string | null;
  provider: string | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  const authIndex = segments.findIndex((segment) => segment === "auth");
  if (authIndex === -1) {
    return { action: null, provider: null };
  }

  return {
    action: segments[authIndex + 1] ?? null,
    provider: segments[authIndex + 2] ?? null,
  };
}

function summarizeQueryEntries(url: URL): Array<{
  key: string;
  valueLength: number;
  valueHash: string | null;
}> {
  const out: Array<{ key: string; valueLength: number; valueHash: string | null }> = [];
  for (const [key, value] of url.searchParams.entries()) {
    out.push({
      key,
      valueLength: value.length,
      valueHash: hashForLog(value),
    });
  }
  return out;
}

function resolveRequestOrigin(request: Request): string | null {
  try {
    const fallback = new URL(request.url);
    const hostHeader =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protoHeader =
      request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");

    if (!hostHeader) return fallback.origin;

    const origin = `${protoHeader}://${hostHeader}`;
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return null;
  }
}

function applyDynamicAuthOrigin(request: Request): void {
  const requestOrigin = resolveRequestOrigin(request);
  if (!requestOrigin) return;

  try {
    const parsed = new URL(requestOrigin);

    // Force Auth.js URL inference to match the request origin.
    // This keeps OAuth redirect_uri and PKCE cookie host aligned.
    // Critical for both local development and production (Vercel) deployments.
    process.env.AUTH_URL = parsed.origin;
    process.env.NEXTAUTH_URL = parsed.origin;
    process.env.NEXTAUTH_URL_INTERNAL = parsed.origin;

    logAuthDebug("Applied dynamic auth origin", {
      requestOrigin: parsed.origin,
      authUrl: process.env.AUTH_URL ?? null,
      nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
      nextAuthUrlInternal: process.env.NEXTAUTH_URL_INTERNAL ?? null,
    });
  } catch {
    // Best effort only.
  }
}

function redactCookieHeader(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      return separatorIndex > 0 ? part.slice(0, separatorIndex) : part;
    });
}

function redactSetCookieHeader(setCookieHeader: string | null): string[] {
  if (!setCookieHeader) return [];

  return setCookieHeader
    .split(/,(?=\s*[^;,=\s]+=)/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((cookie) => {
      const firstPart = cookie.split(";")[0] ?? "";
      const separatorIndex = firstPart.indexOf("=");
      return separatorIndex > 0 ? firstPart.slice(0, separatorIndex) : firstPart;
    })
    .filter(Boolean);
}

function logAuthRequest(request: Request): void {
  try {
    const url = new URL(request.url);
    const route = parseAuthRoute(url.pathname);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const requestOrigin = resolveRequestOrigin(request);
    const cookieHeader = request.headers.get("cookie");
    const cookieKeys = redactCookieHeader(cookieHeader);
    const host = request.headers.get("host");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");

    logAuthDebug("Incoming request", {
      method: request.method,
      routeAction: route.action,
      provider: route.provider,
      url: summarizeUrlForLog(request.url),
      pathname: url.pathname,
      queryKeys: Array.from(url.searchParams.keys()),
      stateHash: hashForLog(state),
      codeLength: code?.length ?? 0,
      error,
      hasErrorDescription: Boolean(errorDescription),
      requestOrigin,
      host,
      forwardedHost,
      forwardedProto,
      authUrl: process.env.AUTH_URL ?? null,
      nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
      cookieCount: cookieKeys.length,
      cookieKeys,
    });

    if (
      oauthVerboseDebugEnabled &&
      (route.provider === "spotify" || route.provider === "discord")
    ) {
      logAuthDebug("Incoming OAuth request (verbose)", {
        provider: route.provider,
        action: route.action,
        queryEntries: summarizeQueryEntries(url),
        referer: summarizeUrlForLog(request.headers.get("referer")),
        origin: summarizeUrlForLog(request.headers.get("origin")),
        secFetchMode: request.headers.get("sec-fetch-mode"),
        secFetchSite: request.headers.get("sec-fetch-site"),
        userAgent: request.headers.get("user-agent"),
      });
    }

    if (route.provider === "spotify" || route.provider === "discord") {
      recordAuthFetchDumpEvent({
        label: `/api/auth/${route.provider}/${route.action ?? "unknown"}`,
        phase: "request",
        details: {
          method: request.method,
          action: route.action,
          provider: route.provider,
          url: summarizeUrlForLog(request.url),
          queryKeys: Array.from(url.searchParams.keys()),
          cookieCount: cookieKeys.length,
        },
      });
    }
  } catch (error) {
    logAuthError("Failed to log incoming auth request details", { error });
  }
}

function logAuthResponse(request: Request, response: Response): void {
  try {
    const setCookie = response.headers.get("set-cookie");
    const setCookieNames = redactSetCookieHeader(setCookie);
    const location = response.headers.get("location");
    const hasPkceCookie = setCookieNames.some((cookieName) =>
      cookieName.toLowerCase().includes("pkce"),
    );
    const hasStateCookie = setCookieNames.some((cookieName) =>
      cookieName.toLowerCase().includes("state"),
    );

    logAuthDebug("Outgoing response", {
      status: response.status,
      location: summarizeUrlForLog(location),
      hasSetCookie: Boolean(setCookie),
      setCookieCount: setCookieNames.length,
      setCookieNames,
      hasPkceCookie,
      hasStateCookie,
    });

    const url = new URL(request.url);
    const route = parseAuthRoute(url.pathname);

    if (
      oauthVerboseDebugEnabled &&
      (route.provider === "spotify" || route.provider === "discord")
    ) {
      logAuthDebug("Outgoing OAuth response (verbose)", {
        provider: route.provider,
        action: route.action,
        status: response.status,
        redirectedTo: summarizeUrlForLog(location),
        setCookieNames,
      });
    }

    if (route.provider === "spotify" || route.provider === "discord") {
      recordAuthFetchDumpEvent({
        label: `/api/auth/${route.provider}/${route.action ?? "unknown"}`,
        phase: "response",
        details: {
          provider: route.provider,
          action: route.action,
          status: response.status,
          location: summarizeUrlForLog(location),
          setCookieNames,
          hasPkceCookie,
          hasStateCookie,
        },
      });
    }
  } catch (error) {
    logAuthError("Failed to log outgoing auth response details", { error });
  }
}

export async function GET(
  request: NextRequest,
  _context: { params: Promise<{ nextauth: string[] }> },
) {
  applyDynamicAuthOrigin(request);
  logAuthRequest(request);
  try {
    const response = await handlers.GET(request);
    logAuthResponse(request, response);
    return response;
  } catch (error) {
    const route = parseAuthRoute(new URL(request.url).pathname);
    if (route.provider === "spotify" || route.provider === "discord") {
      recordAuthFetchDumpEvent({
        label: `/api/auth/${route.provider}/${route.action ?? "unknown"}`,
        phase: "error",
        details: { method: "GET", provider: route.provider, action: route.action, error },
      });
    }
    logAuthError("GET auth handler threw", { url: request.url, error });
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ nextauth: string[] }> },
) {
  applyDynamicAuthOrigin(request);
  logAuthRequest(request);
  try {
    const response = await handlers.POST(request);
    logAuthResponse(request, response);
    return response;
  } catch (error) {
    const route = parseAuthRoute(new URL(request.url).pathname);
    if (route.provider === "spotify" || route.provider === "discord") {
      recordAuthFetchDumpEvent({
        label: `/api/auth/${route.provider}/${route.action ?? "unknown"}`,
        phase: "error",
        details: { method: "POST", provider: route.provider, action: route.action, error },
      });
    }
    logAuthError("POST auth handler threw", { url: request.url, error });
    throw error;
  }
}
