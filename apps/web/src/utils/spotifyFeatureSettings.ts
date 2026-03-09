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

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSpotifyFeatureSettings(
  value: Partial<SpotifyFeatureSettings> | null | undefined,
): SpotifyFeatureSettings {
  return {
    enabled: value?.enabled === true,
    clientId: normalizeText(value?.clientId),
    clientSecret: normalizeText(value?.clientSecret),
    username: normalizeText(value?.username),
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim().length > 0
        ? value.updatedAt
        : null,
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

      return normalizeSpotifyFeatureSettings(
        JSON.parse(stored) as Partial<SpotifyFeatureSettings>,
      );
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
      return normalizeSpotifyFeatureSettings(value);
    }

    const normalized = normalizeSpotifyFeatureSettings({
      ...this.getAll(),
      ...value,
      updatedAt:
        options?.preserveUpdatedAt === true
          ? this.getAll().updatedAt
          : new Date().toISOString(),
    });

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
      ready: settings.clientSecret.length > 0,
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
        "Spotify feature settings are saved locally, but the feature toggle is still off.",
      checks,
    };
  }

  const hasMissingFields = checks.some((check) => !check.ready);

  if (hasMissingFields) {
    return {
      state: "incomplete",
      label: "Spotify setup incomplete",
      description:
        "The local Spotify feature profile is still missing required fields.",
      checks,
    };
  }

  return {
    state: "ready",
    label: "Spotify features ready",
    description:
      "The local Spotify feature profile is complete for the settings-driven Spotify integration path.",
    checks,
  };
}

export function maskSpotifyClientSecret(secret: string): string {
  const trimmed = normalizeText(secret);
  if (trimmed.length === 0) return "Not saved";
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
}
