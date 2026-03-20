// File: apps/web/src/__tests__/spotifyImportErrors.test.ts

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

  it("maps Vercel deployment-protection pages to a backend deployment error", () => {
    expect(
      getSpotifyImportErrorMessageKey({
        message:
          "<!doctype html><title>Authentication Required</title>Vercel Authentication",
        status: 401,
      }),
    ).toBe("importBackendProtected");

    expect(
      getSpotifyImportErrorMessageKey({
        message:
          "Authentication Required. Continue via https://vercel.com/sso-api",
        status: 401,
      }),
    ).toBe("importBackendProtected");
  });

  it("maps generic backend 404 pages to a route/deployment error", () => {
    expect(
      getSpotifyImportErrorMessageKey({
        message: "The page could not be found",
        status: 404,
      }),
    ).toBe("importBackendRouteMissing");
  });
});
