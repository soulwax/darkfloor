// File: packages/auth/src/spotifyProvider.ts

import SpotifyProvider from "next-auth/providers/spotify";

import { logAuthInfo, logAuthWarn } from "./logging";

export interface SpotifyProviderConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

export function createSpotifyProvider(config: SpotifyProviderConfig) {
  if (!config.enabled) {
    logAuthInfo("Spotify provider disabled (AUTH_SPOTIFY_ENABLED is not true)");
    return null;
  }

  const clientId = config.clientId;
  const clientSecret = config.clientSecret;

  if (!clientId || !clientSecret) {
    logAuthWarn(
      "Spotify provider disabled because credentials are missing",
      {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      },
    );
    return null;
  }

  logAuthInfo("Spotify provider enabled", {
    clientIdPrefix: clientId.slice(0, 6),
    scope: "user-read-email user-read-private",
  });

  return SpotifyProvider({
    clientId,
    clientSecret,
    checks: ["pkce", "state"],
    authorization: {
      params: {
        scope: "user-read-email user-read-private",
      },
    },
  });
}
