import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/spotifyAuthClient", () => ({
  clearSpotifyBrowserSessionArtifacts: vi.fn(),
}));

import { appSignOut } from "@/services/authSignOut";
import { clearSpotifyBrowserSessionArtifacts } from "@/services/spotifyAuthClient";
import { signOut } from "next-auth/react";

describe("appSignOut", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears Spotify browser artifacts and legacy Spotify settings on sign-out", async () => {
    window.localStorage.setItem(
      "starchild_spotify_feature_settings",
      JSON.stringify({
        clientId: "client-id",
        clientSecret: "legacy-secret",
      }),
    );

    await appSignOut({ callbackUrl: "/goodbye" });

    expect(clearSpotifyBrowserSessionArtifacts).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/goodbye" });
    expect(
      window.localStorage.getItem("starchild_spotify_feature_settings"),
    ).toBeNull();
  });
});
