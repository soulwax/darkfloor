import { describe, expect, it } from "vitest";

import {
  getSpotifyFeatureConnectionSummary,
  maskSpotifyClientSecret,
  normalizeSpotifyFeatureSettings,
} from "@/utils/spotifyFeatureSettings";

describe("spotifyFeatureSettings", () => {
  it("normalizes incoming values before persistence", () => {
    expect(
      normalizeSpotifyFeatureSettings({
        enabled: true,
        clientId: "  client-id  ",
        clientSecret: "  secret  ",
        username: "  user-name  ",
      }),
    ).toMatchObject({
      enabled: true,
      clientId: "client-id",
      clientSecret: "secret",
      username: "user-name",
    });
  });

  it("reports ready when the local Spotify settings are complete", () => {
    const summary = getSpotifyFeatureConnectionSummary({
      settings: {
        enabled: true,
        clientId: "client-id",
        clientSecret: "client-secret",
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
});
