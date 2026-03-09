import { afterEach, describe, expect, it, vi } from "vitest";

describe("oauth provider config", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("only exposes Discord in the OAuth provider UI list", async () => {
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

  it("ignores Spotify even if Auth.js reports it at runtime", async () => {
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
    ]);
  });

  it("uses the default Discord CTA/action config", async () => {
    const { getOAuthProviderAction, getOAuthProviderCtaLabel } =
      await import("@/config/oauthProviders");

    expect(getOAuthProviderAction("discord")).toEqual({ kind: "signin" });
    expect(getOAuthProviderCtaLabel("discord", "Continue with Discord")).toBe(
      "Continue with Discord",
    );
  });
});
