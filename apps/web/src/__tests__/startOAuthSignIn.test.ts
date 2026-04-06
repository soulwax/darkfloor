// File: apps/web/src/__tests__/startOAuthSignIn.test.ts

import { buildOAuthLaunchUrl } from "@/utils/startOAuthSignIn";
import { describe, expect, it } from "vitest";

describe("buildOAuthLaunchUrl", () => {
  it("launches OAuth on the current origin when no auth API base is configured", () => {
    const parsed = buildOAuthLaunchUrl({
      providerId: "discord",
      callbackUrl: "/library?tab=recent",
      currentOrigin: "https://m.darkfloor.one",
    });

    expect(parsed.origin).toBe("https://m.darkfloor.one");
    expect(parsed.pathname).toBe("/api/auth/launch/discord");
    expect(parsed.searchParams.get("callbackUrl")).toBe(
      "/auth/callback?next=%2Flibrary%3Ftab%3Drecent&provider=discord",
    );
  });

  it("keeps Auth.js OAuth on the current origin even when an API auth base exists", () => {
    const parsed = buildOAuthLaunchUrl({
      providerId: "github",
      callbackUrl: "/playlists",
      currentOrigin: "https://m.darkfloor.one",
    });

    expect(parsed.origin).toBe("https://m.darkfloor.one");
    expect(parsed.pathname).toBe("/api/auth/launch/github");
    expect(parsed.searchParams.get("callbackUrl")).toBe(
      "/auth/callback?next=%2Fplaylists&provider=github",
    );
  });
});
