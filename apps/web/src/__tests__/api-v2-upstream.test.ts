// File: apps/web/src/__tests__/api-v2-upstream.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

function getFetchUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function loadModule() {
  return import("@/lib/server/api-v2-upstream");
}

describe("api-v2-upstream", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("parses API_V2_URLS and keeps API_V2_URL as the final fallback", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URLS:
          "https://api-a.example.com|3, https://api-b.example.com|2\nhttps://api-a.example.com|9",
        API_V2_URL: "https://api-c.example.com/",
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    expect(upstream.getApiV2BaseUrls()).toEqual([
      "https://api-a.example.com",
      "https://api-b.example.com",
      "https://api-c.example.com",
    ]);
    expect(upstream.getApiV2BaseUrlConfigs()).toEqual([
      { url: "https://api-a.example.com", weight: 3 },
      { url: "https://api-b.example.com", weight: 2 },
      { url: "https://api-c.example.com", weight: 1 },
    ]);
  });

  it("prefers pool-specific urls and falls back to the default pool", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URLS: "https://api-default-a.example.com,https://api-default-b.example.com",
        API_V2_READ_URLS: "https://api-read.example.com",
        API_V2_WRITE_URLS: "https://api-write.example.com",
        API_V2_STREAM_URLS: "https://api-stream.example.com",
        API_V2_URL: "https://api-fallback.example.com/",
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    expect(upstream.getApiV2BaseUrls("read")).toEqual([
      "https://api-read.example.com",
      "https://api-default-a.example.com",
      "https://api-default-b.example.com",
      "https://api-fallback.example.com",
    ]);
    expect(upstream.getApiV2BaseUrls("write")).toEqual([
      "https://api-write.example.com",
      "https://api-default-a.example.com",
      "https://api-default-b.example.com",
      "https://api-fallback.example.com",
    ]);
    expect(upstream.getApiV2BaseUrls("stream")).toEqual([
      "https://api-stream.example.com",
      "https://api-default-a.example.com",
      "https://api-default-b.example.com",
      "https://api-fallback.example.com",
    ]);
  });

  it("fails over GET requests to the next configured origin", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URLS: "https://api-a.example.com,https://api-b.example.com",
        API_V2_URL: undefined,
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const result = await upstream.fetchApiV2WithFailover({
      pathname: "/status",
      timeoutMs: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getFetchUrl(fetchMock.mock.calls[0]![0])).toBe(
      "https://api-a.example.com/status",
    );
    expect(getFetchUrl(fetchMock.mock.calls[1]![0])).toBe(
      "https://api-b.example.com/status",
    );
    expect(result.baseUrl).toBe("https://api-b.example.com");
    expect(result.attemptCount).toBe(2);
  });

  it("does not retry POST requests by default", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URLS: "https://api-a.example.com,https://api-b.example.com",
        API_V2_URL: undefined,
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(
      upstream.fetchApiV2WithFailover({
        pathname: "/cache/clear",
        init: {
          method: "POST",
          body: JSON.stringify({ scope: "all" }),
        },
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/ECONNREFUSED/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0]![0])).toBe(
      "https://api-a.example.com/cache/clear",
    );
  });

  it("uses the configured write pool for write requests", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URLS: "https://api-default.example.com",
        API_V2_WRITE_URLS: "https://api-write.example.com",
        API_V2_URL: undefined,
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await upstream.fetchApiV2WithFailover({
      pathname: "/auth/me",
      pool: "write",
      init: {
        method: "POST",
        body: JSON.stringify({ ping: true }),
      },
      timeoutMs: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0]![0])).toBe(
      "https://api-write.example.com/auth/me",
    );
  });

  it("prefers higher-weight origins more often when all nodes are healthy", async () => {
    vi.doMock("@/env", () => ({
      env: {
        API_V2_READ_URLS:
          "https://api-primary.example.com|3,https://api-secondary.example.com|1",
        API_V2_URL: undefined,
      },
    }));

    const upstream = await loadModule();
    upstream.apiV2UpstreamInternals.clearState();

    expect([
      upstream.getPreferredApiV2BaseUrl("read"),
      upstream.getPreferredApiV2BaseUrl("read"),
      upstream.getPreferredApiV2BaseUrl("read"),
      upstream.getPreferredApiV2BaseUrl("read"),
    ]).toEqual([
      "https://api-primary.example.com",
      "https://api-primary.example.com",
      "https://api-primary.example.com",
      "https://api-secondary.example.com",
    ]);
  });
});
