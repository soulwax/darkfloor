// File: apps/web/src/utils/startOAuthSignIn.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";
import { resolveAuthApiBase } from "@/utils/authApiBase";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";

export function buildOAuthLaunchUrl(options: {
  providerId: string;
  callbackUrl: string;
  currentOrigin: string;
}): URL {
  const authOrigin = resolveAuthApiBase({
    configuredBase: process.env.NEXT_PUBLIC_AUTH_API_BASE,
    fallbackOrigin: options.currentOrigin,
  });
  const redirectUrl = buildAuthCallbackUrl(
    options.callbackUrl,
    options.providerId,
  );
  const launchUrl = new URL(
    `/api/auth/launch/${options.providerId}`,
    authOrigin,
  );
  launchUrl.searchParams.set("callbackUrl", redirectUrl);
  return launchUrl;
}

export async function startOAuthSignIn(
  providerId: string,
  callbackUrl: string,
): Promise<void> {
  const launchUrl = buildOAuthLaunchUrl({
    providerId,
    callbackUrl,
    currentOrigin: window.location.origin,
  });

  logAuthClientDebug("Starting OAuth form-post flow", {
    providerId,
    callbackUrl,
    redirectUrl: launchUrl.searchParams.get("callbackUrl"),
    authOrigin: launchUrl.origin,
    rendererOrigin: window.location.origin,
    launchUrl: launchUrl.toString(),
  });

  window.location.assign(launchUrl);
}
