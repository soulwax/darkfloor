import { describe, expect, it } from "vitest";

import { getSpotifyImportErrorMessageKey } from "@/utils/spotifyImportErrors";

describe("spotify import error mapping", () => {
  it("maps legacy Spotify OAuth backend errors to the contract warning", () => {
    expect(
      getSpotifyImportErrorMessageKey({
        message: "Missing Spotify OAuth session cookie.",
        status: 401,
      }),
    ).toBe("importLegacyAuthContract");

    expect(
      getSpotifyImportErrorMessageKey({
        message: "No auth token",
        status: 401,
      }),
    ).toBe("importLegacyAuthContract");
  });

  it("still maps plain unauthorized responses to sign-in required", () => {
    expect(
      getSpotifyImportErrorMessageKey({
        message: "Unauthorized",
        status: 401,
      }),
    ).toBe("signInRequired");
  });
});
