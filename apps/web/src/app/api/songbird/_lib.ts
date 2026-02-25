// File: apps/web/src/app/api/songbird/_lib.ts

import { env } from "@/env";
import {
  SongbirdTokenError,
  getSongbirdAccessToken,
  joinSongbirdUrl,
} from "@/lib/server/songbird-token";
import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 10_000;

type SongbirdProxyError = {
  ok: false;
  status: number;
  message: string;
  details?: unknown;
};

function createErrorResponse(
  status: number,
  message: string,
  details?: unknown,
): NextResponse<SongbirdProxyError> {
  return NextResponse.json(
    {
      ok: false,
      status,
      message,
      ...(details === undefined ? {} : { details }),
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function getSongbirdApiBaseUrl(): string {
  const baseUrl = env.SONGBIRD_API_URL?.trim();
  if (!baseUrl) {
    throw new SongbirdTokenError(500, "SONGBIRD_API_URL is not configured");
  }

  return baseUrl;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function getErrorMessageFromPayload(
  payload: unknown,
  fallback: string,
): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  const record = asRecord(payload);
  if (!record) return fallback;

  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error;
  }

  return fallback;
}

function normalizeErrorDetails(payload: unknown): unknown {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 400
      ? { upstreamText: `${trimmed.slice(0, 400)}...` }
      : { upstreamText: trimmed };
  }

  return payload;
}

async function parseUpstreamPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return await response.text();
}

async function toNextResponse(response: Response): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await parseUpstreamPayload(response);
  } catch {
    payload = null;
  }

  if (response.ok) {
    if (response.status === 204 || payload === null) {
      return new NextResponse(null, {
        status: response.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: { "cache-control": "no-store" },
    });
  }

  const fallbackMessage = `Songbird request failed with status ${response.status}`;
  const message = getErrorMessageFromPayload(payload, fallbackMessage);
  const details =
    payload === null || payload === undefined || payload === ""
      ? undefined
      : normalizeErrorDetails(payload);

  return createErrorResponse(response.status, message, details);
}

async function fetchWithBearerToken(
  pathname: string,
  forceRefresh = false,
): Promise<Response> {
  const token = await getSongbirdAccessToken({ forceRefresh });
  const upstreamUrl = joinSongbirdUrl(getSongbirdApiBaseUrl(), pathname);

  return fetch(upstreamUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `${token.tokenType} ${token.accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function proxySongbirdGet(pathname: string): Promise<NextResponse> {
  try {
    let upstreamResponse = await fetchWithBearerToken(pathname);

    if (upstreamResponse.status === 401) {
      upstreamResponse = await fetchWithBearerToken(pathname, true);
    }

    return await toNextResponse(upstreamResponse);
  } catch (error) {
    if (error instanceof SongbirdTokenError) {
      return createErrorResponse(error.status, error.message, error.details);
    }

    if (error instanceof Error && error.name === "AbortError") {
      return createErrorResponse(504, "Songbird request timed out");
    }

    const message =
      error instanceof Error ? error.message : "Unexpected Songbird proxy error";

    return createErrorResponse(502, "Failed to reach Songbird API", { message });
  }
}
