// File: apps/web/src/utils/startOAuthSignIn.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";

export function buildOAuthLaunchUrl(options: {
  providerId: string;
  callbackUrl: string;
  currentOrigin: string;
}): URL {
  const redirectUrl = buildAuthCallbackUrl(
    options.callbackUrl,
    options.providerId,
  );
  const launchUrl = new URL(
    `/api/auth/launch/${options.providerId}`,
    options.currentOrigin,
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
