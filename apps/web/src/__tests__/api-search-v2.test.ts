// File: apps/web/src/__tests__/api-search-v2.test.ts

import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Music Search API (V2-only)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls V2 search with key/kbps and returns parsed response", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://darkfloor.one/",
        BLUESIX_API_KEY: "test-key",
      },
    }));

    let capturedFetchInput: RequestInfo | URL | undefined;
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        capturedFetchInput = input;
        return new Response(JSON.stringify({ data: [{ id: 1 }], total: 1 }), {
          headers: { "content-type": "application/json" },
        });
      });

    const { GET } = await import("@/app/api/music/search/route");

    const req = {
      nextUrl: new URL(
        "http://localhost:3000/api/music/search?q=I+Disappear&offset=10&kbps=128",
      ),
    } as NextRequest;

    const res = await GET(req);
    const body = (await res.json()) as {
      data: Array<{ id: number }>;
      total: number;
    };

    expect(body).toEqual({ data: [{ id: 1 }], total: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calledUrlArg = capturedFetchInput;
    if (!calledUrlArg) {
      throw new Error("Missing fetch URL");
    }
    const calledUrlString =
      typeof calledUrlArg === "string"
        ? calledUrlArg
        : calledUrlArg instanceof URL
          ? calledUrlArg.toString()
          : calledUrlArg.url;
    const calledUrl = new URL(calledUrlString);
    expect(calledUrl.origin).toBe("https://darkfloor.one");
    expect(calledUrl.pathname).toBe("/music/search");
    expect(calledUrl.searchParams.get("key")).toBe("test-key");
    expect(calledUrl.searchParams.get("kbps")).toBe("128");
    expect(calledUrl.searchParams.get("q")).toBe("I Disappear");
    expect(calledUrl.searchParams.get("offset")).toBe("10");
  });

  it("returns 500 when V2 is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: undefined,
        BLUESIX_API_KEY: undefined,
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");

    const { GET } = await import("@/app/api/music/search/route");

    const req = {
      nextUrl: new URL("http://localhost:3000/api/music/search?q=test"),
    } as NextRequest;

    const res = await GET(req);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/API_V2_URL|BLUESIX_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
