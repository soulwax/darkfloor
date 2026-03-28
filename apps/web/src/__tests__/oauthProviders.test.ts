// File: apps/web/src/__tests__/oauthProviders.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

describe("oauth provider config", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exposes configured Discord and GitHub providers in UI order", async () => {
    const { getEnabledOAuthUiProviders } =
      await import("@/config/oauthProviders");

    expect(
      getEnabledOAuthUiProviders({
        discord: {
          id: "discord",
          name: "Discord",
          type: "oauth",
        },
        github: {
          id: "github",
          name: "GitHub",
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
        id: "github",
        name: "GitHub",
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
        github: {
          id: "github",
          name: "GitHub",
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
        id: "github",
        name: "GitHub",
        authSource: "nextauth",
      },
    ]);
  });

  it("uses the default CTA/action config for both supported providers", async () => {
    const { getOAuthProviderAction, getOAuthProviderCtaLabel } =
      await import("@/config/oauthProviders");

    expect(getOAuthProviderAction("discord")).toEqual({ kind: "signin" });
    expect(getOAuthProviderCtaLabel("discord", "Continue with Discord")).toBe(
      "Continue with Discord",
    );
    expect(getOAuthProviderAction("github")).toEqual({ kind: "signin" });
    expect(getOAuthProviderCtaLabel("github", "Continue with GitHub")).toBe(
      "Continue with GitHub",
    );
  });
});
