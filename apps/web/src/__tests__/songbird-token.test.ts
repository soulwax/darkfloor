// File: apps/web/src/__tests__/songbird-token.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function makeTokenResponse(token: string, expiresIn: number): Response {
  return new Response(
    JSON.stringify({
      accessToken: token,
      tokenType: "Bearer",
      expiresIn,
      scopes: ["profile:read"],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("songbird token helper", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("caches token until expiry window and refreshes after skew", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));

    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com/",
        SONGBIRD_API_HEALTH_URI: "/api/health",
        UNIVERSAL_KEY: "test-universal-key",
      },
    }));

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(makeTokenResponse("token-1", 40))
      .mockResolvedValueOnce(makeTokenResponse("token-2", 300));

    const { getSongbirdAccessToken } = await import(
      "@/lib/server/songbird-token"
    );

    const first = await getSongbirdAccessToken();
    const second = await getSongbirdAccessToken();

    expect(first.accessToken).toBe("token-1");
    expect(second.accessToken).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-02-20T12:00:12.000Z"));
    const refreshed = await getSongbirdAccessToken();

    expect(refreshed.accessToken).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws typed token errors with status/message when token issuance fails", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com",
        SONGBIRD_API_HEALTH_URI: "/api/health",
        UNIVERSAL_KEY: "invalid-key",
      },
    }));

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "invalid key" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const { getSongbirdAccessToken } = await import(
      "@/lib/server/songbird-token"
    );

    await expect(
      getSongbirdAccessToken({ forceRefresh: true }),
    ).rejects.toMatchObject({
      name: "SongbirdTokenError",
      status: 401,
      message: "invalid key",
    });
  });

  it("builds slash-safe Songbird URLs from base + URI", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com/",
        SONGBIRD_API_HEALTH_URI: "api/health",
        UNIVERSAL_KEY: "test-universal-key",
      },
    }));

    const { joinSongbirdUrl, getSongbirdHealthUri } = await import(
      "@/lib/server/songbird-token"
    );

    expect(joinSongbirdUrl("https://xyz.com/", "/api/health")).toBe(
      "https://xyz.com/api/health",
    );
    expect(joinSongbirdUrl("https://xyz.com", "api/health")).toBe(
      "https://xyz.com/api/health",
    );
    expect(getSongbirdHealthUri()).toBe("api/health");
  });
});
