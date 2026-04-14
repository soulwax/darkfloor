// File: apps/web/src/app/admin/clusterDiagnostics.ts

export type ApiClusterNodeStatus = "ok" | "error" | "unknown";
export type ApiClusterNodeState = "unhealthy" | "out-of-sync" | "healthy";

export type ApiClusterPublicConfig = {
  app: {
    name: string | null;
    version: string | null;
  };
  environment: {
    nodeVersion: string | null;
    isNetlify: boolean | null;
  };
  urls: {
    appUrl: string | null;
  };
  cors: {
    origins: string[];
    note: string | null;
  };
};

export type ApiClusterNodeDiagnostics = {
  url: string;
  status: ApiClusterNodeStatus;
  version: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  nodeEnv: string | null;
  isVercel: boolean | null;
  inSync: boolean | null;
  isSelf: boolean | null;
  fetchedAt: string | null;
  requestedUrl: string | null;
  publicConfig: ApiClusterPublicConfig | null;
  error: string | null;
  state: ApiClusterNodeState;
};

export type ApiClusterDiagnostics = {
  baseUrl: string;
  timestamp: string | null;
  localVersion: string | null;
  localUrl: string | null;
  referenceUrl: string | null;
  total: number;
  healthyCount: number;
  inSyncCount: number;
  nodes: ApiClusterNodeDiagnostics[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function readBoolean(
  record: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function readStringArray(
  record: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === "string") {
      return value
        .split(/[,\n]/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return [];
}

function normalizePublicConfig(value: unknown): ApiClusterPublicConfig | null {
  const record = asRecord(value);
  if (!record) return null;

  const app = asRecord(record.app);
  const environment = asRecord(record.environment);
  const urls = asRecord(record.urls);
  const cors = asRecord(record.cors);

  return {
    app: {
      name: app ? readString(app, ["name"]) : null,
      version: app ? readString(app, ["version"]) : null,
    },
    environment: {
      nodeVersion: environment
        ? readString(environment, ["nodeVersion"])
        : null,
      isNetlify: environment
        ? readBoolean(environment, ["isNetlify"])
        : null,
    },
    urls: {
      appUrl: urls ? readString(urls, ["appUrl"]) : null,
    },
    cors: {
      origins: cors ? readStringArray(cors, ["origins"]) : [],
      note: cors ? readString(cors, ["note"]) : null,
    },
  };
}

export function getClusterNodeState(
  node: Pick<
    ApiClusterNodeDiagnostics,
    "status" | "httpStatus" | "error" | "inSync"
  >,
): ApiClusterNodeState {
  const hasHttpFailure =
    typeof node.httpStatus === "number" && node.httpStatus >= 400;
  const hasStatusFailure = node.status !== "ok";
  const hasError = typeof node.error === "string" && node.error.length > 0;

  if (hasHttpFailure || hasStatusFailure || hasError) {
    return "unhealthy";
  }

  if (node.inSync === false) {
    return "out-of-sync";
  }

  return "healthy";
}

export function sortClusterNodes(
  nodes: readonly ApiClusterNodeDiagnostics[],
): ApiClusterNodeDiagnostics[] {
  const getRank = (node: ApiClusterNodeDiagnostics): number => {
    if (node.state === "unhealthy") return 0;
    if (node.state === "out-of-sync") return 1;
    return 2;
  };

  return nodes
    .map((node, index) => ({ index, node }))
    .sort((left, right) => {
      const rankDiff = getRank(left.node) - getRank(right.node);
      if (rankDiff !== 0) return rankDiff;

      if (left.node.isSelf !== right.node.isSelf) {
        return left.node.isSelf ? -1 : 1;
      }

      const leftLatency =
        typeof left.node.responseTimeMs === "number"
          ? left.node.responseTimeMs
          : Number.POSITIVE_INFINITY;
      const rightLatency =
        typeof right.node.responseTimeMs === "number"
          ? right.node.responseTimeMs
          : Number.POSITIVE_INFINITY;
      if (leftLatency !== rightLatency) {
        return leftLatency - rightLatency;
      }

      const urlDiff = left.node.url.localeCompare(right.node.url);
      if (urlDiff !== 0) return urlDiff;

      return left.index - right.index;
    })
    .map((entry) => entry.node);
}

function normalizeNode(
  value: unknown,
  index: number,
): ApiClusterNodeDiagnostics {
  const record = asRecord(value) ?? {};
  const requestedUrl = readString(record, ["requestedUrl"]);
  const fallbackUrl =
    requestedUrl ?? `unknown-node-${String(index + 1).padStart(2, "0")}`;
  const rawStatus = readString(record, ["status"]);
  const status: ApiClusterNodeStatus =
    rawStatus === "ok" || rawStatus === "error" ? rawStatus : "unknown";

  const node: ApiClusterNodeDiagnostics = {
    url: readString(record, ["url"]) ?? fallbackUrl,
    status,
    version: readString(record, ["version"]),
    httpStatus: readNumber(record, ["httpStatus"]),
    responseTimeMs: readNumber(record, ["responseTimeMs"]),
    nodeEnv: readString(record, ["nodeEnv"]),
    isVercel: readBoolean(record, ["isVercel"]),
    inSync: readBoolean(record, ["inSync"]),
    isSelf: readBoolean(record, ["isSelf"]),
    fetchedAt: readString(record, ["fetchedAt"]),
    requestedUrl,
    publicConfig: normalizePublicConfig(record.publicConfig),
    error: readString(record, ["error"]),
    state: "healthy",
  };

  node.state = getClusterNodeState(node);
  return node;
}

export function normalizeClusterDiagnostics(
  payload: unknown,
  baseUrl: string,
): ApiClusterDiagnostics {
  const record = asRecord(payload) ?? {};
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
  const nodes = sortClusterNodes(rawNodes.map((node, index) => normalizeNode(node, index)));

  const derivedHealthyCount = nodes.filter((node) => node.state === "healthy").length;
  const derivedInSyncCount = nodes.filter((node) => node.inSync === true).length;

  return {
    baseUrl,
    timestamp: readString(record, ["timestamp"]),
    localVersion: readString(record, ["localVersion"]),
    localUrl: readString(record, ["localUrl"]),
    referenceUrl: readString(record, ["referenceUrl"]),
    total: readNumber(record, ["total"]) ?? nodes.length,
    healthyCount: readNumber(record, ["healthyCount"]) ?? derivedHealthyCount,
    inSyncCount: readNumber(record, ["inSyncCount"]) ?? derivedInSyncCount,
    nodes,
  };
}
