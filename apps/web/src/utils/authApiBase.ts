// File: apps/web/src/utils/authApiBase.ts

const DEFAULT_AUTH_API_BASE = "https://www.darkfloor.one";
const CANONICAL_AUTH_API_HOSTNAME = "www.darkfloor.one";
const LOOPBACK_HOSTNAMES = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "localhost",
  "::1",
]);
const AUTH_API_HOST_ALIASES = new Set([
  "darkfloor.one",
  CANONICAL_AUTH_API_HOSTNAME,
]);

function parseOrigin(value: string | null | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isLoopbackOrigin(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase());
}

function shouldUseConfiguredAuthBase(
  configuredBase: string,
  fallbackOrigin: string | null | undefined,
): boolean {
  const configuredUrl = parseOrigin(configuredBase);
  const fallbackUrl = parseOrigin(fallbackOrigin);

  if (!configuredUrl || !isLoopbackOrigin(configuredUrl)) {
    return true;
  }

  if (!fallbackUrl || !isLoopbackOrigin(fallbackUrl)) {
    return false;
  }

  return configuredUrl.port === fallbackUrl.port;
}

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
  if (
    configuredBase &&
    shouldUseConfiguredAuthBase(configuredBase, options.fallbackOrigin)
  ) {
    return normalizeAuthApiBase(configuredBase);
  }

  const fallbackOrigin = options.fallbackOrigin?.trim();
  if (fallbackOrigin) {
    return normalizeAuthApiBase(fallbackOrigin);
  }

  return DEFAULT_AUTH_API_BASE;
}

export { DEFAULT_AUTH_API_BASE };
