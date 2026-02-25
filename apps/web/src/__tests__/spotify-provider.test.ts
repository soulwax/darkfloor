// File: apps/web/src/__tests__/spotify-provider.test.ts

import { createSpotifyProvider } from "@starchild/auth";
import { describe, expect, it } from "vitest";

describe("Spotify provider defaults", () => {
  it("enables pkce+state checks when provider is configured", () => {
    const provider = createSpotifyProvider({
      enabled: true,
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    const providerChecks = (
      provider as { options?: { checks?: string[] } } | null
    )?.options?.checks;

    expect(provider).not.toBeNull();
    expect(providerChecks).toEqual(["pkce", "state"]);
  });
});
