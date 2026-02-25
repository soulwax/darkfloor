// File: apps/web/src/utils/healthStatus.ts

export type NormalizedHealthStatus = "ok" | "degraded" | "unhealthy";

function normalizeValue(value: unknown): NormalizedHealthStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === "ok" || normalized === "healthy" || normalized === "up") {
    return "ok";
  }
  if (normalized === "degraded") return "degraded";
  if (normalized === "unhealthy" || normalized === "error" || normalized === "down") {
    return "unhealthy";
  }

  return null;
}

export function normalizeHealthStatus(
  payload: unknown,
  rawText?: string | null,
): NormalizedHealthStatus | null {
  if (payload && typeof payload === "object") {
    const body = payload as { status?: unknown; ok?: unknown };
    const status = body.status;
    const normalized = normalizeValue(status);
    if (normalized) return normalized;

    if (typeof body.ok === "boolean") {
      return body.ok ? "ok" : "unhealthy";
    }
  }

  if (rawText) {
    return normalizeValue(rawText);
  }

  return null;
}
