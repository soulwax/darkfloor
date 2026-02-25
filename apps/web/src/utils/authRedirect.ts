// File: apps/web/src/utils/authRedirect.ts

const AUTH_CALLBACK_ROUTE = "/auth/callback";

function normalizeRequestedPath(callbackUrl: string): string {
  if (!callbackUrl) return "/";
  if (callbackUrl.startsWith("/")) return callbackUrl;

  try {
    const parsed = new URL(callbackUrl);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

export function buildAuthCallbackUrl(
  callbackUrl: string,
  providerId: string,
): string {
  const params = new URLSearchParams({
    next: normalizeRequestedPath(callbackUrl),
    provider: providerId,
  });
  return `${AUTH_CALLBACK_ROUTE}?${params.toString()}`;
}

export function resolvePostAuthPath(
  nextParam: string | null | undefined,
  currentOrigin: string,
): string {
  if (!nextParam) return "/";
  if (nextParam.startsWith("/")) {
    return nextParam.startsWith(AUTH_CALLBACK_ROUTE) ? "/" : nextParam;
  }

  try {
    const parsed = new URL(nextParam);
    if (parsed.origin !== currentOrigin) return "/";
    const resolvedPath = `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    return resolvedPath.startsWith(AUTH_CALLBACK_ROUTE) ? "/" : resolvedPath;
  } catch {
    return "/";
  }
}
