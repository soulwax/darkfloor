// File: apps/web/src/lib/server/api-v2-upstream.ts

import { env } from "@/env";
import { type NextRequest } from "next/server";

const API_V2_FAILURE_COOLDOWN_MS = 30_000;
const API_V2_RETRYABLE_RESPONSE_STATUSES = new Set([502, 503, 504]);
const API_V2_RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type UpstreamRequest = NextRequest | Request;
export type ApiV2UpstreamPool = "default" | "read" | "write" | "stream";

type ApiV2UpstreamState = {
  cooldowns: Map<string, number>;
  nextCursorByPool: Partial<Record<ApiV2UpstreamPool, number>>;
};

type FetchApiV2WithFailoverOptions = {
  pathname: string;
  request?: UpstreamRequest;
  init?: RequestInit;
  timeoutMs?: number;
  retryNonIdempotent?: boolean;
  pool?: ApiV2UpstreamPool;
};

type FetchApiV2WithFailoverResult = {
  attemptCount: number;
  baseUrl: string;
  response: Response;
  upstreamUrl: string;
};

function getState(): ApiV2UpstreamState {
  const globalState = globalThis as typeof globalThis & {
    __darkfloorApiV2UpstreamState?: ApiV2UpstreamState;
  };

  globalState.__darkfloorApiV2UpstreamState ??= {
    cooldowns: new Map<string, number>(),
    nextCursorByPool: {},
  };

  return globalState.__darkfloorApiV2UpstreamState;
}

function normalizeApiV2BaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function parseConfiguredApiV2Urls(rawValue: string | undefined): string[] {
  if (!rawValue) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of rawValue.split(/[\n,]/)) {
    const normalized = normalizeApiV2BaseUrl(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function getRequestUrl(request: UpstreamRequest): URL {
  if ("nextUrl" in request && request.nextUrl instanceof URL) {
    return request.nextUrl;
  }

  return new URL(request.url);
}

function getPoolCursor(pool: ApiV2UpstreamPool): number {
  return getState().nextCursorByPool[pool] ?? 0;
}

function setPoolCursor(pool: ApiV2UpstreamPool, value: number): void {
  getState().nextCursorByPool[pool] = value;
}

function buildOrderedApiV2BaseUrls(pool: ApiV2UpstreamPool): string[] {
  const baseUrls = getApiV2BaseUrls(pool);
  if (baseUrls.length <= 1) return baseUrls;

  const state = getState();
  const now = Date.now();
  const healthy: string[] = [];
  const cooling: Array<{ baseUrl: string; until: number }> = [];

  for (const baseUrl of baseUrls) {
    const until = state.cooldowns.get(baseUrl);
    if (typeof until === "number" && until > now) {
      cooling.push({ baseUrl, until });
      continue;
    }

    state.cooldowns.delete(baseUrl);
    healthy.push(baseUrl);
  }

  const orderedHealthy =
    healthy.length === 0
      ? []
      : healthy
          .slice(getPoolCursor(pool) % healthy.length)
          .concat(healthy.slice(0, getPoolCursor(pool) % healthy.length));

  if (healthy.length > 0) {
    setPoolCursor(pool, (getPoolCursor(pool) + 1) % healthy.length);
  }

  cooling.sort((left, right) => left.until - right.until);
  return orderedHealthy.concat(cooling.map((entry) => entry.baseUrl));
}

function markApiV2BaseUrlSuccess(baseUrl: string): void {
  getState().cooldowns.delete(baseUrl);
}

function markApiV2BaseUrlFailure(baseUrl: string): void {
  getState().cooldowns.set(
    baseUrl,
    Date.now() + API_V2_FAILURE_COOLDOWN_MS,
  );
}

function shouldRetryRequest(
  method: string,
  retryNonIdempotent: boolean | undefined,
): boolean {
  if (retryNonIdempotent) return true;
  return API_V2_RETRYABLE_METHODS.has(method);
}

function getConfiguredPoolUrls(pool: ApiV2UpstreamPool): string[] {
  switch (pool) {
    case "read":
      return parseConfiguredApiV2Urls(env.API_V2_READ_URLS);
    case "write":
      return parseConfiguredApiV2Urls(env.API_V2_WRITE_URLS);
    case "stream":
      return parseConfiguredApiV2Urls(env.API_V2_STREAM_URLS);
    default:
      return parseConfiguredApiV2Urls(env.API_V2_URLS);
  }
}

export function getApiV2BaseUrls(pool: ApiV2UpstreamPool = "default"): string[] {
  const parsedList = getConfiguredPoolUrls(pool);
  if (pool !== "default") {
    for (const baseUrl of getConfiguredPoolUrls("default")) {
      if (!parsedList.includes(baseUrl)) {
        parsedList.push(baseUrl);
      }
    }
  }

  const fallbackSingle = env.API_V2_URL
    ? normalizeApiV2BaseUrl(env.API_V2_URL)
    : null;

  if (fallbackSingle && !parsedList.includes(fallbackSingle)) {
    parsedList.push(fallbackSingle);
  }

  return parsedList;
}

export function getPreferredApiV2BaseUrl(
  pool: ApiV2UpstreamPool = "default",
): string | null {
  return buildOrderedApiV2BaseUrls(pool)[0] ?? null;
}

export function buildApiV2UpstreamUrl(options: {
  baseUrl: string;
  pathname: string;
  request?: UpstreamRequest;
}): string {
  const upstreamUrl = new URL(options.pathname, `${options.baseUrl}/`);

  if (options.request) {
    const requestUrl = getRequestUrl(options.request);
    for (const [key, value] of requestUrl.searchParams.entries()) {
      upstreamUrl.searchParams.append(key, value);
    }
  }

  return upstreamUrl.toString();
}

export async function fetchApiV2WithFailover(
  options: FetchApiV2WithFailoverOptions,
): Promise<FetchApiV2WithFailoverResult> {
  const pool = options.pool ?? "default";
  const baseUrls = buildOrderedApiV2BaseUrls(pool);
  if (baseUrls.length === 0) {
    throw new Error("API_V2_URL is not configured");
  }

  const method = (options.init?.method ?? options.request?.method ?? "GET")
    .toUpperCase()
    .trim();
  const shouldRetry = shouldRetryRequest(method, options.retryNonIdempotent);
  const timeoutMs = options.timeoutMs;

  let lastError: unknown = null;

  for (const [index, baseUrl] of baseUrls.entries()) {
    const upstreamUrl = buildApiV2UpstreamUrl({
      baseUrl,
      pathname: options.pathname,
      request: options.request,
    });

    try {
      const response = await fetch(upstreamUrl, {
        ...options.init,
        method,
        signal:
          timeoutMs === undefined
            ? options.init?.signal
            : AbortSignal.timeout(timeoutMs),
      });

      const isRetryableResponse =
        shouldRetry &&
        API_V2_RETRYABLE_RESPONSE_STATUSES.has(response.status) &&
        index < baseUrls.length - 1;

      if (isRetryableResponse) {
        markApiV2BaseUrlFailure(baseUrl);
        continue;
      }

      if (response.ok) {
        markApiV2BaseUrlSuccess(baseUrl);
      } else if (API_V2_RETRYABLE_RESPONSE_STATUSES.has(response.status)) {
        markApiV2BaseUrlFailure(baseUrl);
      }

      return {
        attemptCount: index + 1,
        baseUrl,
        response,
        upstreamUrl,
      };
    } catch (error) {
      lastError = error;
      markApiV2BaseUrlFailure(baseUrl);

      if (!shouldRetry || index === baseUrls.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("API V2 upstream request failed");
}

export const apiV2UpstreamInternals = {
  buildOrderedApiV2BaseUrls,
  clearState(): void {
    const state = getState();
    state.cooldowns.clear();
    state.nextCursorByPool = {};
  },
  getStateSnapshot(): {
    cooldowns: Record<string, number>;
    nextCursorByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  } {
    const state = getState();
    return {
      cooldowns: Object.fromEntries(state.cooldowns.entries()),
      nextCursorByPool: { ...state.nextCursorByPool },
    };
  },
};
