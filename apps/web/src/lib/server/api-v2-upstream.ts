// File: apps/web/src/lib/server/api-v2-upstream.ts

import { env } from "@/env";
import { type NextRequest } from "next/server";

const API_V2_FAILURE_COOLDOWN_MS = 30_000;
const API_V2_RETRYABLE_RESPONSE_STATUSES = new Set([502, 503, 504]);
const API_V2_RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const API_V2_DEFAULT_WEIGHT = 1;
const API_V2_MAX_WEIGHT = 100;
const API_V2_LATENCY_EWMA_ALPHA = 0.3;
const API_V2_IN_FLIGHT_SCORE_PENALTY = 2;
const API_V2_FAILURE_SCORE_PENALTY = 3;
const API_V2_LATENCY_SCORE_BUCKET_MS = 250;

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
  successCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  failureCount: number;
  failureCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  inFlightCount: number;
  inFlightCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  peakInFlightCount: number;
  peakInFlightCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  consecutiveFailureCount: number;
  consecutiveFailureCountByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  lastSelectedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  lastResponseStatus: number | null;
  lastLatencyMs: number | null;
  latencyEwmaMs: number | null;
};

type ApiV2UpstreamState = {
  cooldownsByPool: Partial<Record<ApiV2UpstreamPool, Map<string, number>>>;
  currentWeightByPool: Partial<Record<ApiV2UpstreamPool, Map<string, number>>>;
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
    cooldownsByPool: {},
    currentWeightByPool: {},
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
    successCountByPool: {},
    failureCount: 0,
    failureCountByPool: {},
    inFlightCount: 0,
    inFlightCountByPool: {},
    peakInFlightCount: 0,
    peakInFlightCountByPool: {},
    consecutiveFailureCount: 0,
    consecutiveFailureCountByPool: {},
    lastSelectedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    lastResponseStatus: null,
    lastLatencyMs: null,
    latencyEwmaMs: null,
  };
  state.metricsByUrl.set(baseUrl, created);
  return created;
}

function getPoolCooldowns(pool: ApiV2UpstreamPool): Map<string, number> {
  const state = getState();
  state.cooldownsByPool[pool] ??= new Map<string, number>();
  return state.cooldownsByPool[pool];
}

function getPoolCurrentWeights(pool: ApiV2UpstreamPool): Map<string, number> {
  const state = getState();
  state.currentWeightByPool[pool] ??= new Map<string, number>();
  return state.currentWeightByPool[pool];
}

function incrementPoolCounter(
  counters: Partial<Record<ApiV2UpstreamPool, number>>,
  pool: ApiV2UpstreamPool,
  amount = 1,
): number {
  const nextValue = (counters[pool] ?? 0) + amount;
  counters[pool] = nextValue;
  return nextValue;
}

function decrementPoolCounter(
  counters: Partial<Record<ApiV2UpstreamPool, number>>,
  pool: ApiV2UpstreamPool,
): number {
  const nextValue = Math.max(0, (counters[pool] ?? 0) - 1);
  counters[pool] = nextValue;
  return nextValue;
}

function completeInFlightCount(
  metrics: ApiV2UpstreamMetrics,
  pool: ApiV2UpstreamPool,
): void {
  metrics.inFlightCount = Math.max(0, metrics.inFlightCount - 1);
  decrementPoolCounter(metrics.inFlightCountByPool, pool);
}

function updateLatencyMetrics(
  metrics: ApiV2UpstreamMetrics,
  latencyMs: number | undefined,
): void {
  if (latencyMs === undefined) return;

  metrics.lastLatencyMs = latencyMs;
  metrics.latencyEwmaMs =
    metrics.latencyEwmaMs === null
      ? latencyMs
      : metrics.latencyEwmaMs * (1 - API_V2_LATENCY_EWMA_ALPHA) +
        latencyMs * API_V2_LATENCY_EWMA_ALPHA;
}

function getSelectionPenalty(pool: ApiV2UpstreamPool, baseUrl: string): number {
  const metrics = getUpstreamMetrics(baseUrl);
  const inFlightCount = metrics.inFlightCountByPool[pool] ?? 0;
  const consecutiveFailures = metrics.consecutiveFailureCountByPool[pool] ?? 0;
  const latencyPenalty =
    metrics.latencyEwmaMs === null
      ? 0
      : Math.min(6, metrics.latencyEwmaMs / API_V2_LATENCY_SCORE_BUCKET_MS);

  return (
    inFlightCount * API_V2_IN_FLIGHT_SCORE_PENALTY +
    consecutiveFailures * API_V2_FAILURE_SCORE_PENALTY +
    latencyPenalty
  );
}

function compareHealthyUpstreams(
  pool: ApiV2UpstreamPool,
  left: ApiV2ResolvedUpstream,
  right: ApiV2ResolvedUpstream,
): number {
  const leftMetrics = getUpstreamMetrics(left.url);
  const rightMetrics = getUpstreamMetrics(right.url);

  const leftFailures = leftMetrics.consecutiveFailureCountByPool[pool] ?? 0;
  const rightFailures = rightMetrics.consecutiveFailureCountByPool[pool] ?? 0;
  if (leftFailures !== rightFailures) {
    return leftFailures - rightFailures;
  }

  const leftInFlight = leftMetrics.inFlightCountByPool[pool] ?? 0;
  const rightInFlight = rightMetrics.inFlightCountByPool[pool] ?? 0;
  if (leftInFlight !== rightInFlight) {
    return leftInFlight - rightInFlight;
  }

  const leftLatency = leftMetrics.latencyEwmaMs ?? Number.POSITIVE_INFINITY;
  const rightLatency = rightMetrics.latencyEwmaMs ?? Number.POSITIVE_INFINITY;
  if (leftLatency !== rightLatency) {
    return leftLatency - rightLatency;
  }

  if (left.weight !== right.weight) {
    return right.weight - left.weight;
  }

  const leftLastSelectedAt = leftMetrics.lastSelectedAt ?? 0;
  const rightLastSelectedAt = rightMetrics.lastSelectedAt ?? 0;
  if (leftLastSelectedAt !== rightLastSelectedAt) {
    return leftLastSelectedAt - rightLastSelectedAt;
  }

  return 0;
}

function selectPrimaryHealthyUpstream(
  pool: ApiV2UpstreamPool,
  upstreams: ApiV2ResolvedUpstream[],
): ApiV2ResolvedUpstream {
  const currentWeights = getPoolCurrentWeights(pool);
  let totalWeight = 0;
  let bestCandidate: ApiV2ResolvedUpstream | null = null;
  let bestCandidateCurrentWeight = 0;
  let bestCandidateScore = Number.NEGATIVE_INFINITY;

  for (const upstream of upstreams) {
    totalWeight += upstream.weight;

    const currentWeight =
      (currentWeights.get(upstream.url) ?? 0) + upstream.weight;
    currentWeights.set(upstream.url, currentWeight);

    const score = currentWeight - getSelectionPenalty(pool, upstream.url);
    if (
      bestCandidate === null ||
      score > bestCandidateScore ||
      (score === bestCandidateScore &&
        compareHealthyUpstreams(pool, upstream, bestCandidate) < 0)
    ) {
      bestCandidate = upstream;
      bestCandidateCurrentWeight = currentWeight;
      bestCandidateScore = score;
    }
  }

  if (!bestCandidate) {
    return upstreams[0]!;
  }

  currentWeights.set(
    bestCandidate.url,
    bestCandidateCurrentWeight - totalWeight,
  );

  return bestCandidate;
}

function orderHealthyUpstreams(
  pool: ApiV2UpstreamPool,
  upstreams: ApiV2ResolvedUpstream[],
): ApiV2ResolvedUpstream[] {
  if (upstreams.length <= 1) return upstreams;

  const preferred = selectPrimaryHealthyUpstream(pool, upstreams);
  const remaining = upstreams
    .filter((upstream) => upstream.url !== preferred.url)
    .sort((left, right) => compareHealthyUpstreams(pool, left, right));

  return [preferred, ...remaining];
}

function buildOrderedApiV2BaseUrls(
  pool: ApiV2UpstreamPool,
): ApiV2ResolvedUpstream[] {
  const baseUrls = getApiV2BaseUrlConfigs(pool);
  if (baseUrls.length <= 1) return baseUrls;

  const cooldowns = getPoolCooldowns(pool);
  const now = Date.now();
  const healthy: ApiV2ResolvedUpstream[] = [];
  const cooling: Array<ApiV2ResolvedUpstream & { until: number }> = [];

  for (const baseUrl of baseUrls) {
    const until = cooldowns.get(baseUrl.url);
    if (typeof until === "number" && until > now) {
      cooling.push({ ...baseUrl, until });
      continue;
    }

    cooldowns.delete(baseUrl.url);
    healthy.push(baseUrl);
  }

  const orderedHealthy = orderHealthyUpstreams(pool, healthy);

  cooling.sort(
    (left, right) => left.until - right.until || right.weight - left.weight,
  );
  return orderedHealthy.concat(
    cooling.map(({ until: _until, ...entry }) => entry),
  );
}

function markApiV2BaseUrlSuccess(
  baseUrl: string,
  pool: ApiV2UpstreamPool,
  responseStatus?: number,
  latencyMs?: number,
): void {
  getPoolCooldowns(pool).delete(baseUrl);
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.successCount += 1;
  incrementPoolCounter(metrics.successCountByPool, pool);
  metrics.consecutiveFailureCount = 0;
  metrics.consecutiveFailureCountByPool[pool] = 0;
  metrics.lastSuccessAt = Date.now();
  metrics.lastFailureReason = null;
  metrics.lastResponseStatus = responseStatus ?? null;
  updateLatencyMetrics(metrics, latencyMs);
  completeInFlightCount(metrics, pool);
}

function markApiV2BaseUrlFailure(
  baseUrl: string,
  pool: ApiV2UpstreamPool,
  reason?: string,
  latencyMs?: number,
  responseStatus?: number,
): void {
  getPoolCooldowns(pool).set(baseUrl, Date.now() + API_V2_FAILURE_COOLDOWN_MS);
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.failureCount += 1;
  incrementPoolCounter(metrics.failureCountByPool, pool);
  metrics.consecutiveFailureCount += 1;
  metrics.consecutiveFailureCountByPool[pool] =
    (metrics.consecutiveFailureCountByPool[pool] ?? 0) + 1;
  metrics.lastFailureAt = Date.now();
  metrics.lastFailureReason = reason ?? null;
  metrics.lastResponseStatus = responseStatus ?? null;
  updateLatencyMetrics(metrics, latencyMs);
  completeInFlightCount(metrics, pool);
}

function markApiV2BaseUrlSelected(
  baseUrl: string,
  pool: ApiV2UpstreamPool,
): void {
  const metrics = getUpstreamMetrics(baseUrl);
  metrics.selectionCount += 1;
  metrics.selectionCountByPool[pool] =
    (metrics.selectionCountByPool[pool] ?? 0) + 1;
  metrics.inFlightCount += 1;
  const poolInFlightCount = incrementPoolCounter(
    metrics.inFlightCountByPool,
    pool,
  );
  metrics.peakInFlightCount = Math.max(
    metrics.peakInFlightCount,
    metrics.inFlightCount,
  );
  metrics.peakInFlightCountByPool[pool] = Math.max(
    metrics.peakInFlightCountByPool[pool] ?? 0,
    poolInFlightCount,
  );
  metrics.lastSelectedAt = Date.now();
}

function shouldRetryRequest(
  method: string,
  retryNonIdempotent: boolean | undefined,
): boolean {
  if (retryNonIdempotent) return true;
  return API_V2_RETRYABLE_METHODS.has(method);
}

function getConfiguredPoolUrls(
  pool: ApiV2UpstreamPool,
): ApiV2ResolvedUpstream[] {
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

export function getApiV2BaseUrls(
  pool: ApiV2UpstreamPool = "default",
): string[] {
  return getApiV2BaseUrlConfigs(pool).map((entry) => entry.url);
}

export function getPreferredApiV2BaseUrl(
  pool: ApiV2UpstreamPool = "default",
): string | null {
  return buildOrderedApiV2BaseUrls(pool)[0]?.url ?? null;
}

export function listConfiguredApiV2Upstreams(): ApiV2ConfiguredUpstream[] {
  const orderedPools: ApiV2UpstreamPool[] = [
    "default",
    "read",
    "write",
    "stream",
  ];
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
    const attemptStartedAt = Date.now();

    try {
      const response = await fetch(upstreamUrl, {
        ...options.init,
        method,
        signal:
          timeoutMs === undefined
            ? options.init?.signal
            : AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Date.now() - attemptStartedAt;
      const isRetryableResponse =
        shouldRetry &&
        API_V2_RETRYABLE_RESPONSE_STATUSES.has(response.status) &&
        index < baseUrls.length - 1;

      if (isRetryableResponse) {
        markApiV2BaseUrlFailure(
          baseUrl,
          pool,
          `retryable_status_${response.status}`,
          latencyMs,
          response.status,
        );
        continue;
      }

      if (API_V2_RETRYABLE_RESPONSE_STATUSES.has(response.status)) {
        markApiV2BaseUrlFailure(
          baseUrl,
          pool,
          `status_${response.status}`,
          latencyMs,
          response.status,
        );
      } else {
        markApiV2BaseUrlSuccess(baseUrl, pool, response.status, latencyMs);
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
        pool,
        error instanceof Error ? error.message : String(error),
        Date.now() - attemptStartedAt,
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
    for (const cooldowns of Object.values(state.cooldownsByPool)) {
      cooldowns?.clear();
    }
    for (const currentWeights of Object.values(state.currentWeightByPool)) {
      currentWeights?.clear();
    }
    state.metricsByUrl.clear();
    state.nextCursorByPool = {};
  },
  getStateSnapshot(): {
    cooldowns: Record<string, number>;
    cooldownsByPool: Partial<Record<ApiV2UpstreamPool, Record<string, number>>>;
    metricsByUrl: Record<string, ApiV2UpstreamMetrics>;
    currentWeightByPool: Partial<
      Record<ApiV2UpstreamPool, Record<string, number>>
    >;
    nextCursorByPool: Partial<Record<ApiV2UpstreamPool, number>>;
  } {
    const state = getState();
    const cooldownsByPool = Object.fromEntries(
      Object.entries(state.cooldownsByPool).map(([pool, cooldowns]) => [
        pool,
        Object.fromEntries((cooldowns ?? new Map<string, number>()).entries()),
      ]),
    ) as Partial<Record<ApiV2UpstreamPool, Record<string, number>>>;
    const cooldowns = Object.values(cooldownsByPool).reduce<
      Record<string, number>
    >((aggregate, poolCooldowns) => {
      for (const [url, until] of Object.entries(poolCooldowns ?? {})) {
        aggregate[url] = Math.max(aggregate[url] ?? 0, until);
      }
      return aggregate;
    }, {});

    return {
      cooldowns,
      cooldownsByPool,
      metricsByUrl: Object.fromEntries(state.metricsByUrl.entries()),
      currentWeightByPool: Object.fromEntries(
        Object.entries(state.currentWeightByPool).map(([pool, weights]) => [
          pool,
          Object.fromEntries((weights ?? new Map<string, number>()).entries()),
        ]),
      ) as Partial<Record<ApiV2UpstreamPool, Record<string, number>>>,
      nextCursorByPool: { ...state.nextCursorByPool },
    };
  },
  listConfiguredApiV2Upstreams,
};
