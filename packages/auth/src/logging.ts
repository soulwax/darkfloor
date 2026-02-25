// File: packages/auth/src/logging.ts

import { createHash } from "crypto";

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|code|state|session|csrf|nonce|key)/i;
const MAX_ARRAY_ITEMS = 12;
const MAX_STRING_LENGTH = 180;
const MAX_DEPTH = 4;

type LogLevel = "debug" | "info" | "warn" | "error";
type AuthFetchPhase = "request" | "response" | "error";

export type AuthLogDumpEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
};

export type AuthFetchDumpEntry = {
  timestamp: string;
  label: string;
  phase: AuthFetchPhase;
  details?: unknown;
};

const MAX_AUTH_LOG_DUMP_ENTRIES = 400;
const MAX_AUTH_FETCH_DUMP_ENTRIES = 600;
const authLogDump: AuthLogDumpEntry[] = [];
const authFetchDump: AuthFetchDumpEntry[] = [];

function pushBounded<T>(target: T[], entry: T, maxItems: number): void {
  target.push(entry);
  if (target.length <= maxItems) return;

  const overflow = target.length - maxItems;
  target.splice(0, overflow);
}

function truncate(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...(+${value.length - MAX_STRING_LENGTH} chars)`;
}

function redactValue(value: unknown): string {
  if (typeof value === "string") {
    return `[redacted:${value.length}]`;
  }
  return "[redacted]";
}

function sanitizeObject(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  if (depth >= MAX_DEPTH) {
    return { _truncated: true };
  }

  if (seen.has(value)) {
    return { _circular: true };
  }
  seen.add(value);

  const entries: [string, unknown][] = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      entries.push([key, redactValue(entryValue)]);
      continue;
    }
    entries.push([key, sanitize(entryValue, depth + 1, seen)]);
  }
  return Object.fromEntries(entries);
}

function sanitizeArray(
  value: unknown[],
  depth: number,
  seen: WeakSet<object>,
): unknown[] {
  if (depth >= MAX_DEPTH) return ["[truncated]"];
  const limited = value.slice(0, MAX_ARRAY_ITEMS);
  const sanitized = limited.map((item) => sanitize(item, depth + 1, seen));
  if (value.length > MAX_ARRAY_ITEMS) {
    sanitized.push(`...(+${value.length - MAX_ARRAY_ITEMS} items)`);
  }
  return sanitized;
}

function sanitize(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof URL) {
    return summarizeUrlForLog(value.toString());
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stackPreview: value.stack?.split("\n").slice(0, 3).join("\n") ?? null,
    };
  }

  if (Array.isArray(value)) {
    return sanitizeArray(value, depth, seen);
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth, seen);
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  return "[unsupported]";
}

function emit(level: LogLevel, message: string, details?: unknown): void {
  const prefix = `[Auth ${level.toUpperCase()}] ${message}`;
  const payload =
    details === undefined
      ? undefined
      : sanitize(details, 0, new WeakSet<object>());

  pushBounded(
    authLogDump,
    {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(payload === undefined ? {} : { details: payload }),
    },
    MAX_AUTH_LOG_DUMP_ENTRIES,
  );

  if (level === "error") {
    console.error(prefix, payload);
    return;
  }

  if (level === "warn") {
    console.warn(prefix, payload);
    return;
  }

  if (level === "info") {
    console.info(prefix, payload);
    return;
  }

  console.log(prefix, payload);
}

export function isAuthDebugEnabled(): boolean {
  return (
    process.env.AUTH_DEBUG_OAUTH === "true" ||
    process.env.NEXT_PUBLIC_AUTH_DEBUG_OAUTH === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.ELECTRON_BUILD === "true"
  );
}

export function isOAuthVerboseDebugEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_AUTH_DEBUG_OAUTH === "true" ||
    process.env.AUTH_DEBUG_OAUTH === "true"
  );
}

export function hashForLog(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function summarizeUrlForLog(urlValue: string | null | undefined) {
  if (!urlValue) return null;

  const fallbackOrigin = "http://auth.local";
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlValue);

  try {
    const parsed = new URL(urlValue, fallbackOrigin);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");

    return {
      origin: isAbsolute ? parsed.origin : null,
      pathname: parsed.pathname,
      queryKeys: Array.from(parsed.searchParams.keys()),
      codeLength: code?.length ?? 0,
      stateHash: hashForLog(state),
      hasError: parsed.searchParams.has("error"),
      error: parsed.searchParams.get("error"),
      hasErrorDescription: parsed.searchParams.has("error_description"),
    };
  } catch {
    return { parseError: true, preview: truncate(urlValue) };
  }
}

export function logAuthDebug(message: string, details?: unknown): void {
  if (!isAuthDebugEnabled()) return;
  emit("debug", message, details);
}

export function logAuthInfo(message: string, details?: unknown): void {
  if (!isAuthDebugEnabled()) return;
  emit("info", message, details);
}

export function logAuthWarn(message: string, details?: unknown): void {
  emit("warn", message, details);
}

export function logAuthError(message: string, details?: unknown): void {
  emit("error", message, details);
}

export function recordAuthFetchDumpEvent(input: {
  label: string;
  phase: AuthFetchPhase;
  details?: unknown;
}): void {
  if (!isAuthDebugEnabled()) return;

  const payload =
    input.details === undefined
      ? undefined
      : sanitize(input.details, 0, new WeakSet<object>());

  pushBounded(
    authFetchDump,
    {
      timestamp: new Date().toISOString(),
      label: input.label,
      phase: input.phase,
      ...(payload === undefined ? {} : { details: payload }),
    },
    MAX_AUTH_FETCH_DUMP_ENTRIES,
  );
}

export function getAuthFetchDump(limit?: number): AuthFetchDumpEntry[] {
  const cappedLimit = Math.max(1, Math.min(limit ?? 200, 2000));
  return authFetchDump.slice(-cappedLimit);
}

export function clearAuthFetchDump(): void {
  authFetchDump.length = 0;
}

export function getAuthLogDump(limit?: number): AuthLogDumpEntry[] {
  const cappedLimit = Math.max(1, Math.min(limit ?? 200, 2000));
  return authLogDump.slice(-cappedLimit);
}

export function clearAuthLogDump(): void {
  authLogDump.length = 0;
}
