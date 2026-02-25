// File: apps/web/src/config/oauthProviders.ts

/**
 * Single source of truth for OAuth provider configuration
 */
const OAUTH_PROVIDERS = {
  discord: {
    name: "Discord",
    buttonStyle:
      "bg-[#5865F2] text-white hover:brightness-110 active:brightness-95",
  },
  spotify: {
    name: "Spotify",
    buttonStyle:
      "bg-[#1DB954] text-white hover:brightness-110 active:brightness-95",
  },
} as const;

export type SupportedOAuthProviderId = keyof typeof OAUTH_PROVIDERS;

type OAuthProviderConfig = (typeof OAUTH_PROVIDERS)[SupportedOAuthProviderId];

/**
 * Button styles mapped by provider ID (derived from OAUTH_PROVIDERS)
 */
export const OAUTH_PROVIDER_BUTTON_STYLES: Record<
  SupportedOAuthProviderId,
  string
> = {
  discord: OAUTH_PROVIDERS.discord.buttonStyle,
  spotify: OAUTH_PROVIDERS.spotify.buttonStyle,
} as const;

/**
 * Enabled providers based on environment configuration
 */
const isSpotifyEnabled =
  process.env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED === "true";

export const ENABLED_OAUTH_PROVIDER_IDS: readonly SupportedOAuthProviderId[] =
  isSpotifyEnabled ? ["discord", "spotify"] : ["discord"];

const enabledProviderIds = new Set<SupportedOAuthProviderId>(
  ENABLED_OAUTH_PROVIDER_IDS,
);

/**
 * Type guard to validate and narrow provider ID to enabled providers
 */
export function isEnabledOAuthProviderId(
  providerId: string,
): providerId is SupportedOAuthProviderId {
  return enabledProviderIds.has(providerId as SupportedOAuthProviderId);
}

/**
 * Type guard for runtime provider objects returned by NextAuth
 */
export function isEnabledOAuthProvider<T extends { id: string; type: string }>(
  provider: T,
): provider is T & { id: SupportedOAuthProviderId; type: "oauth" } {
  return provider.type === "oauth" && isEnabledOAuthProviderId(provider.id);
}

/**
 * Get the display name for an OAuth provider
 */
export function getOAuthProviderDisplayName(
  providerId: SupportedOAuthProviderId,
): string {
  return OAUTH_PROVIDERS[providerId].name;
}

/**
 * Get the button style for an OAuth provider
 */
export function getOAuthProviderButtonStyle(
  providerId: SupportedOAuthProviderId,
): string {
  return OAUTH_PROVIDERS[providerId].buttonStyle;
}

/**
 * Get complete configuration for an OAuth provider
 */
export function getOAuthProviderConfig(
  providerId: SupportedOAuthProviderId,
): OAuthProviderConfig {
  return OAUTH_PROVIDERS[providerId];
}
