import { afterEach, describe, expect, it, vi } from "vitest";

describe("oauth provider config", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED;
    vi.resetModules();
  });

  it("marks Spotify as a NextAuth-managed provider when available", async () => {
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
        spotify: {
          id: "spotify",
          name: "Spotify",
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
        authSource: "nextauth",
      },
    ]);
  });

  it("does not synthesize Spotify when Auth.js does not report it", async () => {
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

  it("exposes the Spotify migration guide CTA override", async () => {
    const {
      SPOTIFY_MIGRATION_GUIDE_LABEL,
      SPOTIFY_MIGRATION_GUIDE_URL,
      getOAuthProviderAction,
      getOAuthProviderCtaLabel,
    } = await import("@/config/oauthProviders");

    expect(getOAuthProviderAction("spotify")).toEqual({
      kind: "link",
      href: SPOTIFY_MIGRATION_GUIDE_URL,
      target: "_self",
    });
    expect(
      getOAuthProviderCtaLabel("spotify", "Continue with Spotify"),
    ).toBe(SPOTIFY_MIGRATION_GUIDE_LABEL);
  });
});
