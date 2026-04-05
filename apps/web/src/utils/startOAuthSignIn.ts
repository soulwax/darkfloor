// File: apps/web/src/utils/startOAuthSignIn.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";
import { resolveAuthApiBase } from "@/utils/authApiBase";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";

export function buildOAuthLaunchUrl(options: {
  providerId: string;
  callbackUrl: string;
  currentOrigin: string;
  configuredAuthApiBase?: string | null;
}): URL {
  const redirectUrl = buildAuthCallbackUrl(
    options.callbackUrl,
    options.providerId,
  );
  const authOrigin = resolveAuthApiBase({
    configuredBase: options.configuredAuthApiBase,
    fallbackOrigin: options.currentOrigin,
  });
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
    configuredAuthApiBase: process.env.NEXT_PUBLIC_AUTH_API_BASE,
  });

  logAuthClientDebug("Starting OAuth form-post flow", {
    providerId,
    callbackUrl,
    redirectUrl: launchUrl.searchParams.get("callbackUrl"),
    authOrigin: launchUrl.origin,
    launchUrl: launchUrl.toString(),
  });

  window.location.assign(launchUrl);
}
