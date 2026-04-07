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
          "https://api-a.example.com, https://api-b.example.com\nhttps://api-a.example.com",
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
});
