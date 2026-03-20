// File: apps/web/src/utils/authApiBase.ts

const DEFAULT_AUTH_API_BASE = "https://www.darkfloor.one";
const CANONICAL_AUTH_API_HOSTNAME = "www.darkfloor.one";
const AUTH_API_HOST_ALIASES = new Set([
  "darkfloor.one",
  CANONICAL_AUTH_API_HOSTNAME,
]);

export function normalizeAuthApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    if (AUTH_API_HOST_ALIASES.has(parsed.hostname.toLowerCase())) {
      return DEFAULT_AUTH_API_BASE;
    }

    return parsed.origin;
  } catch {
    return trimmed;
  }
}

export function resolveAuthApiBase(options: {
  configuredBase?: string | null;
  fallbackOrigin?: string | null;
}): string {
  const configuredBase = options.configuredBase?.trim();
  if (configuredBase) {
    return normalizeAuthApiBase(configuredBase);
  }

  const fallbackOrigin = options.fallbackOrigin?.trim();
  if (fallbackOrigin) {
    return normalizeAuthApiBase(fallbackOrigin);
  }

  return DEFAULT_AUTH_API_BASE;
}

export { DEFAULT_AUTH_API_BASE };
