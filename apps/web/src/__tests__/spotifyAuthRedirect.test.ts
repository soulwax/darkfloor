import {
  buildSpotifyFrontendRedirectUri,
  normalizeFrontendOrigin,
  resolveSpotifyPostAuthPath,
} from "@/utils/spotifyAuthRedirect";
import { describe, expect, it } from "vitest";

describe("spotifyAuthRedirect", () => {
  it("canonicalizes apex darkfloor frontend origins to www", () => {
    expect(normalizeFrontendOrigin("https://darkfloor.org")).toBe(
      "https://www.darkfloor.org",
    );
    expect(normalizeFrontendOrigin("https://www.darkfloor.org")).toBe(
      "https://www.darkfloor.org",
    );
  });

  it("builds frontend callback URIs on the canonical www host", () => {
    const redirectUri = buildSpotifyFrontendRedirectUri({
      next: "/library",
      origin: "https://darkfloor.org",
      traceId: "trace-www-1",
    });

    const parsed = new URL(redirectUri);
    expect(parsed.origin).toBe("https://www.darkfloor.org");
    expect(parsed.pathname).toBe("/auth/spotify/callback");
    expect(parsed.searchParams.get("next")).toBe("/library");
    expect(parsed.searchParams.get("trace")).toBe("trace-www-1");
  });

  it("treats apex and www origins as equivalent for same-site next paths", () => {
    expect(
      resolveSpotifyPostAuthPath(
        "https://darkfloor.org/library?view=recent",
        "https://www.darkfloor.org",
      ),
    ).toBe("/library?view=recent");
  });
});
