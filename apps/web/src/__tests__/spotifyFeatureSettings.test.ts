// File: apps/web/src/__tests__/spotifyFeatureSettings.test.ts

import { beforeEach, describe, expect, it } from "vitest";

import {
  buildSpotifyFeaturePreferenceInput,
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  hasCompleteSpotifyFeatureSettings,
  maskSpotifyClientId,
  maskSpotifyClientSecret,
  normalizeSpotifyFeatureSettings,
  spotifyFeatureSettingsStorage,
} from "@/utils/spotifyFeatureSettings";

describe("spotifyFeatureSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes incoming values before persistence", () => {
    expect(
      normalizeSpotifyFeatureSettings({
        enabled: true,
        clientId: "  client-id  ",
        clientSecret: "  secret  ",
        username: "  user-name  ",
        updatedAt: new Date("2026-03-08T00:00:00.000Z"),
      }),
    ).toMatchObject({
      enabled: true,
      clientId: "client-id",
      clientSecret: "secret",
      clientSecretConfigured: true,
      username: "user-name",
      updatedAt: "2026-03-08T00:00:00.000Z",
    });
  });

  it("extracts spotify settings from per-user preferences records", () => {
    expect(
      extractSpotifyFeatureSettingsFromPreferences({
        spotifyFeaturesEnabled: true,
        spotifyClientId: " client-id ",
        spotifyClientSecret: " secret ",
        spotifyUsername: " user-name ",
        spotifySettingsUpdatedAt: new Date("2026-03-09T00:00:00.000Z"),
      }),
    ).toEqual({
      enabled: true,
      clientId: "client-id",
      clientSecret: "secret",
      clientSecretConfigured: true,
      username: "user-name",
      updatedAt: "2026-03-09T00:00:00.000Z",
    });
  });

  it("auto-enables complete spotify settings when building preference input", () => {
    expect(
      buildSpotifyFeaturePreferenceInput({
        enabled: false,
        clientId: "client-id",
        clientSecret: "client-secret",
        clientSecretConfigured: true,
        username: "spotify-user",
        updatedAt: null,
      }),
    ).toEqual({
      spotifyFeaturesEnabled: true,
      spotifyClientId: "client-id",
      spotifyClientSecret: "client-secret",
      spotifyUsername: "spotify-user",
    });
  });

  it("can preserve a previously saved secret without re-sending it", () => {
    expect(
      buildSpotifyFeaturePreferenceInput(
        {
          enabled: true,
          clientId: "client-id",
          clientSecret: "",
          clientSecretConfigured: true,
          username: "spotify-user",
          updatedAt: null,
        },
        {
          includeClientSecret: false,
        },
      ),
    ).toEqual({
      spotifyFeaturesEnabled: true,
      spotifyClientId: "client-id",
      spotifyUsername: "spotify-user",
    });
  });

  it("reports when required spotify fields are complete", () => {
    expect(
      hasCompleteSpotifyFeatureSettings({
        clientId: "client-id",
        clientSecret: "client-secret",
        clientSecretConfigured: true,
        username: "spotify-user",
      }),
    ).toBe(true);

    expect(
      hasCompleteSpotifyFeatureSettings({
        clientId: "client-id",
        clientSecret: "",
        clientSecretConfigured: true,
        username: "spotify-user",
      }),
    ).toBe(true);

    expect(
      hasCompleteSpotifyFeatureSettings({
        clientId: "client-id",
        clientSecret: "",
        clientSecretConfigured: false,
        username: "spotify-user",
      }),
    ).toBe(false);
  });

  it("reports ready when the local Spotify settings are complete", () => {
    const summary = getSpotifyFeatureConnectionSummary({
      settings: {
        enabled: true,
        clientId: "client-id",
        clientSecret: "",
        clientSecretConfigured: true,
        username: "spotify-user",
        updatedAt: "2026-03-08T00:00:00.000Z",
      },
    });

    expect(summary.state).toBe("ready");
    expect(summary.checks.every((check) => check.ready)).toBe(true);
  });

  it("reports incomplete when required Spotify settings are missing", () => {
    const summary = getSpotifyFeatureConnectionSummary({
      settings: {
        enabled: true,
        clientId: "client-id",
        clientSecret: "",
        clientSecretConfigured: false,
        username: "spotify-user",
        updatedAt: "2026-03-08T00:00:00.000Z",
      },
    });

    expect(summary.state).toBe("incomplete");
    expect(summary.label).toMatch(/incomplete/i);
  });

  it("masks spotify client secrets for display", () => {
    expect(maskSpotifyClientSecret("")).toBe("Not saved");
    expect(maskSpotifyClientSecret("abcdef1234")).toBe("ab••••34");
  });

  it("masks spotify client ids for compact display", () => {
    expect(maskSpotifyClientId("")).toBe("Not saved");
    expect(maskSpotifyClientId("abcdef12")).toBe("ab...12");
    expect(maskSpotifyClientId("abcdef1234567890")).toBe("abcd...7890");
  });

  it("sanitizes client secrets before saving to local storage", () => {
    const saved = spotifyFeatureSettingsStorage.save({
      clientId: "client-id",
      clientSecret: "client-secret",
      username: "spotify-user",
    });

    expect(saved.clientSecret).toBe("");
    expect(saved.clientSecretConfigured).toBe(true);

    expect(
      JSON.parse(
        window.localStorage.getItem("starchild_spotify_feature_settings") ??
          "{}",
      ),
    ).toMatchObject({
      clientId: "client-id",
      clientSecret: "",
      clientSecretConfigured: true,
      username: "spotify-user",
    });
  });

  it("scrubs legacy stored secrets when reading browser storage", () => {
    window.localStorage.setItem(
      "starchild_spotify_feature_settings",
      JSON.stringify({
        clientId: "client-id",
        clientSecret: "legacy-secret",
        username: "spotify-user",
      }),
    );

    expect(spotifyFeatureSettingsStorage.getAll()).toMatchObject({
      clientId: "client-id",
      clientSecret: "",
      clientSecretConfigured: true,
      username: "spotify-user",
    });

    expect(
      JSON.parse(
        window.localStorage.getItem("starchild_spotify_feature_settings") ??
          "{}",
      ),
    ).toMatchObject({
      clientSecret: "",
      clientSecretConfigured: true,
    });
  });
});
