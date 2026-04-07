// File: apps/web/src/lib/server/api-v2-upstream.ts

import { env } from "@/env";
import { type NextRequest } from "next/server";

const API_V2_FAILURE_COOLDOWN_MS = 30_000;
const API_V2_RETRYABLE_RESPONSE_STATUSES = new Set([502, 503, 504]);
const API_V2_RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const API_V2_DEFAULT_WEIGHT = 1;
const API_V2_MAX_WEIGHT = 100;

type UpstreamRequest = NextRequest | Request;
export type ApiV2UpstreamPool = "default" | "read" | "write" | "stream";
type ApiV2ResolvedUpstream = {
  url: string;
  weight: number;
};
export type ApiV2ConfiguredUpstream = {
  url: string;
  pools: ApiV2UpstreamPool[];
  poolWeights: Partial<Record<ApiV2UpstreamPool, number>>;
};
type ApiV2UpstreamMetrics = {
  selectionCount: number;
  selectionCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  successCount: number;
  failureCount: number;
  lastSelectedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
};

type ApiV2UpstreamState = {
  cooldowns: Map<string, number>;
  metricsByUrl: Map<string, ApiV2UpstreamMetrics>;
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
    metricsByUrl: new Map<string, ApiV2UpstreamMetrics>(),
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

function normalizeUpstreamWeight(value: string | undefined): number {
  if (!value) return API_V2_DEFAULT_WEIGHT;

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return API_V2_DEFAULT_WEIGHT;
  }

  return Math.min(API_V2_MAX_WEIGHT, parsed);
}

function parseConfiguredApiV2Urls(
  rawValue: string | undefined,
): ApiV2ResolvedUpstream[] {
  if (!rawValue) return [];

  const out = new Map<string, ApiV2ResolvedUpstream>();

  for (const entry of rawValue.split(/[\n,]/)) {
    const [rawUrl, rawWeight] = entry.split("|", 2);
    const normalizedUrl = normalizeApiV2BaseUrl(rawUrl ?? entry);
    if (!normalizedUrl) continue;

    if (out.has(normalizedUrl)) continue;

    out.set(normalizedUrl, {
      url: normalizedUrl,
      weight: normalizeUpstreamWeight(rawWeight),
    });
  }

  return Array.from(out.values());
}

function getRequestUrl(request: UpstreamRequest): URL {
  if ("nextUrl" in request && request.nextUrl instanceof URL) {
    return request.nextUrl;
  }

  return new URL(request.url);
}

function getUpstreamMetrics(baseUrl: string): ApiV2UpstreamMetrics {
  const state = getState();
  const existing = state.metricsByUrl.get(baseUrl);
  if (existing) return existing;

  const created: ApiV2UpstreamMetrics = {
    selectionCount: 0,
    selectionCountByPool: {},
    successCount: 0,
    failureCount: 0,
    lastSelectedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
  };
  state.metricsByUrl.set(baseUrl, created);
  return created;
}

function getPoolCursor(pool: ApiV2UpstreamPool): number {
  return getState().nextCursorByPool[pool] ?? 0;
}

function setPoolCursor(pool: ApiV2UpstreamPool, value: number): void {
  getState().nextCursorByPool[pool] = value;
}

function buildWeightedSchedule(
  upstreams: ApiV2ResolvedUpstream[],
): ApiV2ResolvedUpstream[] {
  const schedule: ApiV2ResolvedUpstream[] = [];

  for (const upstream of upstreams) {
    for (let index = 0; index < upstream.weight; index += 1) {
      schedule.push(upstream);
    }
  }

  return schedule;
}

function dedupeOrderedUpstreams(
  upstreams: ApiV2ResolvedUpstream[],
): ApiV2ResolvedUpstream[] {
  const seen = new Set<string>();
  const deduped: ApiV2ResolvedUpstream[] = [];

  for (const upstream of upstreams) {
    if (seen.has(upstream.url)) continue;
    seen.add(upstream.url);
    deduped.push(upstream);
  }

  return deduped;
}

function rotateWeightedUpstreams(
  pool: ApiV2UpstreamPool,
  upstreams: ApiV2ResolvedUpstream[],
): ApiV2ResolvedUpstream[] {
  if (upstreams.length <= 1) return upstreams;

  const weightedSchedule = buildWeightedSchedule(upstreams);
  if (weightedSchedule.length <= 1) return dedupeOrderedUpstreams(weightedSchedule);

  const cursor = getPoolCursor(pool) % weightedSchedule.length;
  const rotated = weightedSchedule
    .slice(cursor)
    .concat(weightedSchedule.slice(0, cursor));

  setPoolCursor(pool, (cursor + 1) % weightedSchedule.length);
  return dedupeOrderedUpstreams(rotated);
}

function buildOrderedApiV2BaseUrls(
  pool: ApiV2UpstreamPool,
): ApiV2ResolvedUpstream[] {
  const baseUrls = getApiV2BaseUrlConfigs(pool);
  if (baseUrls.length <= 1) return baseUrls;

  const state = getState();
  const now = Date.now();
  const healthy: ApiV2ResolvedUpstream[] = [];
  const cooling: Array<ApiV2ResolvedUpstream & { until: number }> = [];

  for (const baseUrl of baseUrls) {
    const until = state.cooldowns.get(baseUrl.url);
    if (typeof until === "number" && until > now) {
      cooling.push({ ...baseUrl, until });
      continue;
    }

    state.cooldowns.delete(baseUrl.url);
    healthy.push(baseUrl);
  }

  const orderedHealthy = rotateWeightedUpstreams(pool, healthy);

  cooling.sort(
    (left, right) =>
      left.until - right.until || right.weight - left.weight,
  );
  return orderedHealthy.concat(
    cooling.map(({ until: _until, ...entry }) => entry),
  );
}

function markApiV2BaseUrlSuccess(baseUrl: string): void {
  getState().cooldowns.delete(baseUrl);
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.successCount += 1;
  metrics.lastSuccessAt = Date.now();
}

function markApiV2BaseUrlFailure(baseUrl: string, reason?: string): void {
  getState().cooldowns.set(
    baseUrl,
    Date.now() + API_V2_FAILURE_COOLDOWN_MS,
  );
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.failureCount += 1;
  metrics.lastFailureAt = Date.now();
  metrics.lastFailureReason = reason ?? null;
}

function markApiV2BaseUrlSelected(
  baseUrl: string,
  pool: ApiV2UpstreamPool,
): void {
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.selectionCount += 1;
  metrics.selectionCountByPool[pool] =
    (metrics.selectionCountByPool[pool] ?? 0) + 1;
  metrics.lastSelectedAt = Date.now();
}

function shouldRetryRequest(
  method: string,
  retryNonIdempotent: boolean | undefined,
): boolean {
  if (retryNonIdempotent) return true;
  return API_V2_RETRYABLE_METHODS.has(method);
}

function getConfiguredPoolUrls(pool: ApiV2UpstreamPool): ApiV2ResolvedUpstream[] {
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

export function getApiV2BaseUrlConfigs(
  pool: ApiV2UpstreamPool = "default",
): ApiV2ResolvedUpstream[] {
  const merged = new Map<string, ApiV2ResolvedUpstream>();

  for (const config of getConfiguredPoolUrls(pool)) {
    merged.set(config.url, config);
  }

  if (pool !== "default") {
    for (const config of getConfiguredPoolUrls("default")) {
      if (!merged.has(config.url)) {
        merged.set(config.url, config);
      }
    }
  }

  const fallbackSingle = env.API_V2_URL
    ? normalizeApiV2BaseUrl(env.API_V2_URL)
    : null;

  if (fallbackSingle && !merged.has(fallbackSingle)) {
    merged.set(fallbackSingle, {
      url: fallbackSingle,
      weight: API_V2_DEFAULT_WEIGHT,
    });
  }

  return Array.from(merged.values());
}

export function getApiV2BaseUrls(pool: ApiV2UpstreamPool = "default"): string[] {
  return getApiV2BaseUrlConfigs(pool).map((entry) => entry.url);
}

export function getPreferredApiV2BaseUrl(
  pool: ApiV2UpstreamPool = "default",
): string | null {
  return buildOrderedApiV2BaseUrls(pool)[0]?.url ?? null;
}

export function listConfiguredApiV2Upstreams(): ApiV2ConfiguredUpstream[] {
  const orderedPools: ApiV2UpstreamPool[] = ["default", "read", "write", "stream"];
  const poolMembership = new Map<
    string,
    {
      pools: Set<ApiV2UpstreamPool>;
      poolWeights: Partial<Record<ApiV2UpstreamPool, number>>;
    }
  >();

  for (const pool of orderedPools) {
    for (const entry of getApiV2BaseUrlConfigs(pool)) {
      const current = poolMembership.get(entry.url) ?? {
        pools: new Set<ApiV2UpstreamPool>(),
        poolWeights: {},
      };
      current.pools.add(pool);
      current.poolWeights[pool] = entry.weight;
      poolMembership.set(entry.url, current);
    }
  }

  return Array.from(poolMembership.entries()).map(([url, value]) => ({
    url,
    pools: orderedPools.filter((pool) => value.pools.has(pool)),
    poolWeights: value.poolWeights,
  }));
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

  for (const [index, baseUrlEntry] of baseUrls.entries()) {
    const baseUrl = baseUrlEntry.url;
    const upstreamUrl = buildApiV2UpstreamUrl({
      baseUrl,
      pathname: options.pathname,
      request: options.request,
    });
    markApiV2BaseUrlSelected(baseUrl, pool);

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
        markApiV2BaseUrlFailure(baseUrl, `retryable_status_${response.status}`);
        continue;
      }

      if (response.ok) {
        markApiV2BaseUrlSuccess(baseUrl);
      } else if (API_V2_RETRYABLE_RESPONSE_STATUSES.has(response.status)) {
        markApiV2BaseUrlFailure(baseUrl, `status_${response.status}`);
      }

      return {
        attemptCount: index + 1,
        baseUrl,
        response,
        upstreamUrl,
      };
    } catch (error) {
      lastError = error;
      markApiV2BaseUrlFailure(
        baseUrl,
        error instanceof Error ? error.message : String(error),
      );

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
    metricsByUrl: Record<string, ApiV2UpstreamMetrics>;
    nextCursorByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  } {
    const state = getState();
    return {
      cooldowns: Object.fromEntries(state.cooldowns.entries()),
      metricsByUrl: Object.fromEntries(state.metricsByUrl.entries()),
      nextCursorByPool: { ...state.nextCursorByPool },
    };
  },
  listConfiguredApiV2Upstreams,
};
