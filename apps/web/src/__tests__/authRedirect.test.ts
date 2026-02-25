// File: apps/web/src/__tests__/authRedirect.test.ts

import {
  buildAuthCallbackUrl,
  resolvePostAuthPath,
} from "@/utils/authRedirect";
import { describe, expect, it } from "vitest";

describe("authRedirect utils", () => {
  it("builds a callback bridge URL with provider and destination", () => {
    const callbackUrl = buildAuthCallbackUrl("/playlists?tab=mine", "spotify");
    const parsed = new URL(callbackUrl, "http://localhost:3222");

    expect(parsed.pathname).toBe("/auth/callback");
    expect(parsed.searchParams.get("provider")).toBe("spotify");
    expect(parsed.searchParams.get("next")).toBe("/playlists?tab=mine");
  });

  it("resolves same-origin absolute URLs and rejects cross-origin targets", () => {
    expect(
      resolvePostAuthPath(
        "https://starchild.local/library?section=favorites",
        "https://starchild.local",
      ),
    ).toBe("/library?section=favorites");

    expect(
      resolvePostAuthPath("https://attacker.example/steal", "https://starchild.local"),
    ).toBe("/");
  });

  it("avoids callback-loop redirects", () => {
    expect(resolvePostAuthPath("/auth/callback?next=%2Flibrary", "https://x")).toBe(
      "/",
    );
  });
});
