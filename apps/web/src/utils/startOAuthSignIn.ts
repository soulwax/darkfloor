// File: apps/web/src/utils/startOAuthSignIn.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";

export async function startOAuthSignIn(
  providerId: string,
  callbackUrl: string,
): Promise<void> {
  const redirectUrl = buildAuthCallbackUrl(callbackUrl, providerId);
  const launchUrl = new URL(
    `/api/auth/launch/${providerId}`,
    window.location.origin,
  );
  launchUrl.searchParams.set("callbackUrl", redirectUrl);

  logAuthClientDebug("Starting OAuth form-post flow", {
    providerId,
    callbackUrl,
    redirectUrl,
    launchUrl: launchUrl.toString(),
  });

  window.location.assign(launchUrl);
}
