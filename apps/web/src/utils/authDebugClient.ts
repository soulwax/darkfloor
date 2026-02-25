// File: apps/web/src/utils/authDebugClient.ts

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|code|state|session|csrf|nonce|key)/i;
const MAX_DEPTH = 3;

function sanitize(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => sanitize(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitize(entryValue, depth + 1, seen),
      ],
    );
    return Object.fromEntries(entries);
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  return "[unsupported]";
}

export function isClientAuthDebugEnabled(): boolean {
  const explicitAuthDebug = process.env.NEXT_PUBLIC_AUTH_DEBUG;
  const authDebugEnabled =
    explicitAuthDebug === "1" || explicitAuthDebug === "true";

  return (
    authDebugEnabled ||
    process.env.NEXT_PUBLIC_AUTH_DEBUG_OAUTH === "true" ||
    process.env.NODE_ENV === "development"
  );
}

export function logAuthClientDebug(message: string, details?: unknown): void {
  if (!isClientAuthDebugEnabled()) return;
  if (details === undefined) {
    console.info(`[Auth Client] ${message}`);
    return;
  }
  console.info(`[Auth Client] ${message}`, sanitize(details));
}
