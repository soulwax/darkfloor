// File: apps/web/src/utils/getOAuthRedirectUri.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";

export function getOAuthRedirectUri(providerId: string): string | undefined {
  if (typeof window === "undefined" || !providerId) {
    return undefined;
  }

  // Keep OAuth callback host exactly aligned with the current renderer origin
  // so PKCE/state cookies are written and read on the same host.
  const origin = window.location.origin;
  const redirectUri = `${origin}/api/auth/callback/${encodeURIComponent(providerId)}`;
  logAuthClientDebug("Computed OAuth redirect_uri", {
    providerId,
    origin,
    redirectUri,
  });
  return redirectUri;
}
