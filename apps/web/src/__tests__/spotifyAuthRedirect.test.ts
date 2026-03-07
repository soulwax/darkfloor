import {
  buildSpotifyFrontendRedirectUri,
  resolveSpotifyPostAuthPath,
} from "@/utils/spotifyAuthRedirect";
import { describe, expect, it } from "vitest";

describe("spotifyAuthRedirect", () => {
  it("builds frontend callback URIs on the current frontend origin", () => {
    const redirectUri = buildSpotifyFrontendRedirectUri({
      next: "/library",
      origin: "https://darkfloor.org",
      traceId: "trace-www-1",
    });

    const parsed = new URL(redirectUri);
    expect(parsed.origin).toBe("https://darkfloor.org");
    expect(parsed.pathname).toBe("/auth/spotify/callback");
    expect(parsed.searchParams.get("next")).toBe("/library");
    expect(parsed.searchParams.get("trace")).toBe("trace-www-1");
  });

  it("rejects cross-origin next URLs even when only host variant differs", () => {
    expect(
      resolveSpotifyPostAuthPath(
        "https://darkfloor.org/library?view=recent",
        "https://www.darkfloor.org",
      ),
    ).toBe("/library");
  });
});
