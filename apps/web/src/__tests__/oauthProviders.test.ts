import { afterEach, describe, expect, it, vi } from "vitest";

describe("oauth provider config", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED;
    vi.resetModules();
  });

  it("keeps backend-managed Spotify visible in UI when NextAuth only returns Discord", async () => {
    process.env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED = "true";

    const { getEnabledOAuthUiProviders } =
      await import("@/config/oauthProviders");

    expect(
      getEnabledOAuthUiProviders({
        discord: {
          id: "discord",
          name: "Discord",
          type: "oauth",
        },
      }),
    ).toEqual([
      {
        id: "discord",
        name: "Discord",
        authSource: "nextauth",
      },
      {
        id: "spotify",
        name: "Spotify",
        authSource: "backend",
      },
    ]);
  });

  it("omits Spotify from UI when the public feature flag is disabled", async () => {
    const { getEnabledOAuthUiProviders } =
      await import("@/config/oauthProviders");

    expect(
      getEnabledOAuthUiProviders({
        discord: {
          id: "discord",
          name: "Discord",
          type: "oauth",
        },
      }),
    ).toEqual([
      {
        id: "discord",
        name: "Discord",
        authSource: "nextauth",
      },
    ]);
  });
});
