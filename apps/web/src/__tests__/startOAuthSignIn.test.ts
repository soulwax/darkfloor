// File: apps/web/src/__tests__/startOAuthSignIn.test.ts

import { buildOAuthLaunchUrl } from "@/utils/startOAuthSignIn";
import { afterEach, describe, expect, it } from "vitest";

const originalAuthApiBase = process.env.NEXT_PUBLIC_AUTH_API_BASE;

afterEach(() => {
  if (originalAuthApiBase === undefined) {
    delete process.env.NEXT_PUBLIC_AUTH_API_BASE;
    return;
  }

  process.env.NEXT_PUBLIC_AUTH_API_BASE = originalAuthApiBase;
});

describe("buildOAuthLaunchUrl", () => {
  it("launches OAuth on the current origin when no auth API base is configured", () => {
    delete process.env.NEXT_PUBLIC_AUTH_API_BASE;
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

  it("launches OAuth on the configured auth origin when an auth API base exists", () => {
    process.env.NEXT_PUBLIC_AUTH_API_BASE = "http://127.0.0.1:3222";

    const parsed = buildOAuthLaunchUrl({
      providerId: "github",
      callbackUrl: "/playlists",
      currentOrigin: "http://localhost:3222",
    });

    expect(parsed.origin).toBe("http://127.0.0.1:3222");
    expect(parsed.pathname).toBe("/api/auth/launch/github");
    expect(parsed.searchParams.get("callbackUrl")).toBe(
      "/auth/callback?next=%2Fplaylists&provider=github",
    );
  });
});
