// File: apps/web/src/utils/spotifyFeatureSettings.ts

import {
  DEFAULT_SPOTIFY_FEATURE_SETTINGS,
  type SpotifyFeatureConnectionState,
  type SpotifyFeatureSettings,
} from "@starchild/types/spotifySettings";

const SPOTIFY_FEATURE_SETTINGS_STORAGE_KEY =
  "starchild_spotify_feature_settings";
export const SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT =
  "starchild:spotify-feature-settings-updated";

type SpotifyFeatureConnectionCheck = {
  id: "enabled" | "clientId" | "clientSecret" | "username";
  label: string;
  ready: boolean;
};

export type SpotifyFeatureConnectionSummary = {
  state: SpotifyFeatureConnectionState;
  label: string;
  description: string;
  checks: SpotifyFeatureConnectionCheck[];
};

type SpotifyFeaturePreferenceRecord = Partial<
  Record<
    | "spotifyFeaturesEnabled"
    | "spotifyClientId"
    | "spotifyClientSecret"
    | "spotifyClientSecretConfigured"
    | "spotifyUsername"
    | "spotifySettingsUpdatedAt",
    unknown
  >
>;

type SpotifyFeatureSettingsInput = Partial<
  Omit<SpotifyFeatureSettings, "updatedAt">
> & {
  updatedAt?: string | Date | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfiguredSecretFlag(value: unknown): boolean {
  return value === true;
}

function sanitizeSpotifyFeatureSettingsForStorage(
  settings: SpotifyFeatureSettings,
): SpotifyFeatureSettings {
  return {
    ...settings,
    clientSecret: "",
    clientSecretConfigured:
      settings.clientSecretConfigured || settings.clientSecret.length > 0,
  };
}

export function normalizeSpotifyFeatureSettings(
  value?: SpotifyFeatureSettingsInput | null,
): SpotifyFeatureSettings {
  const clientSecret = normalizeText(value?.clientSecret);
  const updatedAt =
    typeof value?.updatedAt === "string" && value.updatedAt.trim().length > 0
      ? value.updatedAt
      : value?.updatedAt instanceof Date
        ? value.updatedAt.toISOString()
        : null;

  return {
    enabled: value?.enabled === true,
    clientId: normalizeText(value?.clientId),
    clientSecret,
    clientSecretConfigured:
      normalizeConfiguredSecretFlag(value?.clientSecretConfigured) ||
      clientSecret.length > 0,
    username: normalizeText(value?.username),
    updatedAt,
  };
}

export function hasConfiguredSpotifyFeatureSettings(
  settings: SpotifyFeatureSettings,
): boolean {
  return Boolean(
    settings.enabled ||
    settings.clientId.length > 0 ||
    settings.clientSecretConfigured ||
    settings.username.length > 0,
  );
}

export function hasCompleteSpotifyFeatureSettings(
  settings: Pick<
    SpotifyFeatureSettings,
    "clientId" | "clientSecret" | "clientSecretConfigured" | "username"
  >,
): boolean {
  return Boolean(
    settings.clientId.trim().length > 0 &&
    (settings.clientSecret.trim().length > 0 ||
      settings.clientSecretConfigured) &&
    settings.username.trim().length > 0,
  );
}

export function extractSpotifyFeatureSettingsFromPreferences(
  value: SpotifyFeaturePreferenceRecord | null | undefined,
): SpotifyFeatureSettings {
  return normalizeSpotifyFeatureSettings({
    enabled: value?.spotifyFeaturesEnabled === true,
    clientId: normalizeText(value?.spotifyClientId),
    clientSecret: normalizeText(value?.spotifyClientSecret),
    clientSecretConfigured:
      normalizeConfiguredSecretFlag(value?.spotifyClientSecretConfigured) ||
      normalizeText(value?.spotifyClientSecret).length > 0,
    username: normalizeText(value?.spotifyUsername),
    updatedAt:
      typeof value?.spotifySettingsUpdatedAt === "string" ||
      value?.spotifySettingsUpdatedAt instanceof Date
        ? value.spotifySettingsUpdatedAt
        : null,
  });
}

export function buildSpotifyFeaturePreferenceInput(
  settings: SpotifyFeatureSettings,
  options?: { includeClientSecret?: boolean },
): {
  spotifyFeaturesEnabled: boolean;
  spotifyClientId: string;
  spotifyClientSecret?: string;
  spotifyUsername: string;
} {
  const spotifyFeaturesEnabled = hasCompleteSpotifyFeatureSettings(settings);

  return {
    spotifyFeaturesEnabled,
    spotifyClientId: settings.clientId,
    ...(options?.includeClientSecret !== false
      ? { spotifyClientSecret: settings.clientSecret }
      : {}),
    spotifyUsername: settings.username,
  };
}

export const spotifyFeatureSettingsStorage = {
  get(): Partial<SpotifyFeatureSettings> {
    if (typeof window === "undefined") return {};

    try {
      const stored = window.localStorage.getItem(
        SPOTIFY_FEATURE_SETTINGS_STORAGE_KEY,
      );
      if (!stored) return {};

      const sanitized = sanitizeSpotifyFeatureSettingsForStorage(
        normalizeSpotifyFeatureSettings(
          JSON.parse(stored) as Partial<SpotifyFeatureSettings>,
        ),
      );
      window.localStorage.setItem(
        SPOTIFY_FEATURE_SETTINGS_STORAGE_KEY,
        JSON.stringify(sanitized),
      );

      return sanitized;
    } catch (error) {
      console.error(
        "Failed to load Spotify feature settings from localStorage:",
        error,
      );
      return {};
    }
  },

  getAll(): SpotifyFeatureSettings {
    return {
      ...DEFAULT_SPOTIFY_FEATURE_SETTINGS,
      ...this.get(),
    };
  },

  save(
    value: Partial<SpotifyFeatureSettings>,
    options?: { preserveUpdatedAt?: boolean },
  ): SpotifyFeatureSettings {
    if (typeof window === "undefined") {
      return sanitizeSpotifyFeatureSettingsForStorage(
        normalizeSpotifyFeatureSettings(value),
      );
    }

    const current = this.getAll();
    const normalized = sanitizeSpotifyFeatureSettingsForStorage(
      normalizeSpotifyFeatureSettings({
        ...current,
        ...value,
        updatedAt:
          options?.preserveUpdatedAt === true
            ? (normalizeSpotifyFeatureSettings(value).updatedAt ??
              current.updatedAt)
            : new Date().toISOString(),
      }),
    );

    try {
      window.localStorage.setItem(
        SPOTIFY_FEATURE_SETTINGS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
      window.dispatchEvent(
        new CustomEvent(SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT, {
          detail: normalized,
        }),
      );
    } catch (error) {
      console.error(
        "Failed to save Spotify feature settings to localStorage:",
        error,
      );
    }

    return normalized;
  },

  clear(): void {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(SPOTIFY_FEATURE_SETTINGS_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent(SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT, {
          detail: DEFAULT_SPOTIFY_FEATURE_SETTINGS,
        }),
      );
    } catch (error) {
      console.error(
        "Failed to clear Spotify feature settings from localStorage:",
        error,
      );
    }
  },
};

export function getSpotifyFeatureConnectionSummary(options: {
  settings: SpotifyFeatureSettings;
}): SpotifyFeatureConnectionSummary {
  const { settings } = options;

  const checks: SpotifyFeatureConnectionCheck[] = [
    {
      id: "enabled",
      label: "Spotify features enabled",
      ready: settings.enabled,
    },
    {
      id: "clientId",
      label: "Client ID saved",
      ready: settings.clientId.length > 0,
    },
    {
      id: "clientSecret",
      label: "Client secret saved",
      ready: settings.clientSecretConfigured,
    },
    {
      id: "username",
      label: "Username saved",
      ready: settings.username.length > 0,
    },
  ];

  if (!settings.enabled) {
    return {
      state: "disabled",
      label: "Spotify features disabled",
      description:
        "The saved Spotify feature profile is still disabled.",
      checks,
    };
  }

  const hasMissingFields = checks.some((check) => !check.ready);

  if (hasMissingFields) {
    return {
      state: "incomplete",
      label: "Spotify setup incomplete",
      description:
        "The saved Spotify feature profile is still missing required fields.",
      checks,
    };
  }

  return {
    state: "ready",
    label: "Spotify features ready",
    description:
      "The saved Spotify feature profile is complete for the settings-driven Spotify integration path.",
    checks,
  };
}

export function maskSpotifyClientSecret(secret: string): string {
  const trimmed = normalizeText(secret);
  if (trimmed.length === 0) return "Not saved";
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
}

export function maskSpotifyClientId(clientId: string): string {
  const trimmed = normalizeText(clientId);
  if (trimmed.length === 0) return "Not saved";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
