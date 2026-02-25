// File: apps/web/src/__tests__/api-songbird-routes.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

type SongbirdToken = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scopes: string[];
  expiresAt: number;
};

type SongbirdTokenMock = ReturnType<typeof vi.fn<(...args: never[]) => Promise<SongbirdToken>>>;

function createTokenMock(): SongbirdTokenMock {
  return vi.fn<(...args: never[]) => Promise<SongbirdToken>>();
}

function createSongbirdTokenErrorClass() {
  return class MockSongbirdTokenError extends Error {
    status: number;
    details?: unknown;

    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.name = "SongbirdTokenError";
      this.status = status;
      this.details = details;
    }
  };
}

function normalizeUrl(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

describe("songbird proxy routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies /api/songbird/auth-me using bearer token from server helper", async () => {
    vi.resetModules();
    const getSongbirdAccessToken = createTokenMock();
    const SongbirdTokenError = createSongbirdTokenErrorClass();

    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com/",
      },
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      SongbirdTokenError,
      getSongbirdAccessToken,
      joinSongbirdUrl: normalizeUrl,
    }));

    getSongbirdAccessToken.mockResolvedValue({
      accessToken: "token-1",
      tokenType: "Bearer",
      expiresIn: 120,
      scopes: ["profile:read"],
      expiresAt: Date.now() + 120_000,
    });

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ userId: "abc-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const route = await import("@/app/api/songbird/auth-me/route");
    const response = await route.GET();
    const body = (await response.json()) as { userId?: string };

    expect(response.status).toBe(200);
    expect(body.userId).toBe("abc-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://songbirdapi.com/api/auth/me");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("retries once on 401 with force-refreshed token", async () => {
    vi.resetModules();
    const getSongbirdAccessToken = createTokenMock();
    const SongbirdTokenError = createSongbirdTokenErrorClass();

    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com",
      },
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      SongbirdTokenError,
      getSongbirdAccessToken,
      joinSongbirdUrl: normalizeUrl,
    }));

    getSongbirdAccessToken
      .mockResolvedValueOnce({
        accessToken: "expired-token",
        tokenType: "Bearer",
        expiresIn: 5,
        scopes: [],
        expiresAt: Date.now() + 5_000,
      })
      .mockResolvedValueOnce({
        accessToken: "fresh-token",
        tokenType: "Bearer",
        expiresIn: 120,
        scopes: [],
        expiresAt: Date.now() + 120_000,
      });

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, userId: "abc-123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const route = await import("@/app/api/songbird/auth-me/route");
    const response = await route.GET();
    const body = (await response.json()) as { userId?: string };

    expect(response.status).toBe(200);
    expect(body.userId).toBe("abc-123");
    expect(getSongbirdAccessToken).toHaveBeenCalledTimes(2);
    expect(getSongbirdAccessToken).toHaveBeenNthCalledWith(1, {
      forceRefresh: false,
    });
    expect(getSongbirdAccessToken).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1];
    expect(new Headers(secondCall?.[1]?.headers).get("authorization")).toBe(
      "Bearer fresh-token",
    );
  });

  it("normalizes upstream failures for UI consumption", async () => {
    vi.resetModules();
    const getSongbirdAccessToken = createTokenMock();
    const SongbirdTokenError = createSongbirdTokenErrorClass();

    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com",
      },
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      SongbirdTokenError,
      getSongbirdAccessToken,
      joinSongbirdUrl: normalizeUrl,
    }));

    getSongbirdAccessToken.mockResolvedValue({
      accessToken: "token-1",
      tokenType: "Bearer",
      expiresIn: 120,
      scopes: [],
      expiresAt: Date.now() + 120_000,
    });

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("upstream exploded", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );

    const route = await import("@/app/api/songbird/auth-me/route");
    const response = await route.GET();
    const body = (await response.json()) as {
      ok?: boolean;
      status?: number;
      message?: string;
      details?: { upstreamText?: string };
    };

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.status).toBe(502);
    expect(body.message).toBe("upstream exploded");
    expect(body.details?.upstreamText).toContain("upstream exploded");
  });

  it("proxies /api/songbird/cache-stats to /cache/stats", async () => {
    vi.resetModules();
    const getSongbirdAccessToken = createTokenMock();
    const SongbirdTokenError = createSongbirdTokenErrorClass();

    vi.doMock("@/env", () => ({
      env: {
        SONGBIRD_API_URL: "https://songbirdapi.com/",
      },
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      SongbirdTokenError,
      getSongbirdAccessToken,
      joinSongbirdUrl: normalizeUrl,
    }));

    getSongbirdAccessToken.mockResolvedValue({
      accessToken: "token-1",
      tokenType: "Bearer",
      expiresIn: 120,
      scopes: ["cache:read"],
      expiresAt: Date.now() + 120_000,
    });

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ entries: 12 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const route = await import("@/app/api/songbird/cache-stats/route");
    const response = await route.GET();
    const body = (await response.json()) as { entries?: number };

    expect(response.status).toBe(200);
    expect(body.entries).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://songbirdapi.com/cache/stats");
  });
});
