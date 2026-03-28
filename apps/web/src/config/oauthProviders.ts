// File: apps/web/src/config/oauthProviders.ts

type OAuthProviderAction =
  | {
      kind: "signin";
    };

/**
 * Single source of truth for OAuth provider configuration
 */
const OAUTH_PROVIDERS = {
  discord: {
    name: "Discord",
    authSource: "nextauth",
    action: {
      kind: "signin",
    } satisfies OAuthProviderAction,
    buttonStyle:
      "bg-[#5865F2] text-white hover:brightness-110 active:brightness-95",
  },
  github: {
    name: "GitHub",
    authSource: "nextauth",
    action: {
      kind: "signin",
    } satisfies OAuthProviderAction,
    buttonStyle:
      "bg-[#171515] text-white hover:brightness-110 active:brightness-95",
  },
} as const;

export type SupportedOAuthProviderId = keyof typeof OAUTH_PROVIDERS;

type OAuthProviderConfig = (typeof OAUTH_PROVIDERS)[SupportedOAuthProviderId];
type OAuthRuntimeProvider = {
  id: string;
  name: string;
  type: string;
};

export type OAuthProviderAuthSource = OAuthProviderConfig["authSource"];
export type EnabledOAuthUiProvider = {
  id: SupportedOAuthProviderId;
  name: string;
  authSource: OAuthProviderAuthSource;
};

const SUPPORTED_OAUTH_PROVIDER_IDS = Object.keys(
  OAUTH_PROVIDERS,
) as SupportedOAuthProviderId[];

/**
 * Button styles mapped by provider ID (derived from OAUTH_PROVIDERS)
 */
export const OAUTH_PROVIDER_BUTTON_STYLES: Record<
  SupportedOAuthProviderId,
  string
> = {
  discord: OAUTH_PROVIDERS.discord.buttonStyle,
  github: OAUTH_PROVIDERS.github.buttonStyle,
} as const;

/**
 * Enabled providers based on environment configuration
 */
export const ENABLED_OAUTH_PROVIDER_IDS: readonly SupportedOAuthProviderId[] =
  (() => {
    const providers: SupportedOAuthProviderId[] = ["discord"];

    const githubId = process.env.AUTH_GITHUB_ID;
    const githubSecret = process.env.AUTH_GITHUB_SECRET;

    if (githubId && githubSecret) {
      providers.push("github");
    }

    return providers;
  })();
const supportedProviderIds = new Set<SupportedOAuthProviderId>(
  SUPPORTED_OAUTH_PROVIDER_IDS,
);

/**
 * Type guard to validate and narrow provider ID to enabled providers
 */
export function isEnabledOAuthProviderId(
  providerId: string,
): providerId is SupportedOAuthProviderId {
  return supportedProviderIds.has(providerId as SupportedOAuthProviderId);
}

/**
 * Type guard for runtime provider objects returned by NextAuth
 */
export function isEnabledOAuthProvider<T extends { id: string; type: string }>(
  provider: T,
): provider is T & { id: SupportedOAuthProviderId; type: "oauth" } {
  return provider.type === "oauth" && isEnabledOAuthProviderId(provider.id);
}

export function getEnabledOAuthUiProviders(
  providers?: Record<string, OAuthRuntimeProvider> | null,
): EnabledOAuthUiProvider[] {
  if (!providers) return [];

  return SUPPORTED_OAUTH_PROVIDER_IDS.flatMap((providerId) => {
    const provider = providers[providerId];
    if (!provider || !isEnabledOAuthProvider(provider)) return [];

    return [
      {
        id: provider.id,
        name: provider.name || OAUTH_PROVIDERS[provider.id].name,
        authSource: OAUTH_PROVIDERS[provider.id].authSource,
      },
    ];
  });
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

export function getOAuthProviderAction(
  providerId: SupportedOAuthProviderId,
): OAuthProviderAction {
  return OAUTH_PROVIDERS[providerId].action;
}

export function getOAuthProviderCtaLabel(
  providerId: SupportedOAuthProviderId,
  defaultLabel: string,
): string {
  return defaultLabel;
}
