// File: apps/web/src/__tests__/api-admin-upstreams-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type GetRouteModule = { GET: GetRouteHandler };

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`);
}

async function loadGetRoute(modulePath: string): Promise<GetRouteModule> {
  return (await import(modulePath)) as unknown as GetRouteModule;
}

describe("admin upstream diagnostics route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("blocks non-admin sessions", async () => {
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1", admin: false } })),
    }));
    vi.doMock("@/lib/server/api-v2-upstream", () => ({
      listConfiguredApiV2Upstreams: vi.fn(() => []),
    }));

    const route = await loadGetRoute("@/app/api/admin/api-upstreams/route");
    const response = await route.GET(makeRequest("/api/admin/api-upstreams"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });

  it("returns one entry per configured upstream with probe results", async () => {
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@/lib/server/api-v2-upstream", () => ({
      listConfiguredApiV2Upstreams: vi.fn(() => [
        {
          url: "https://api-a.example.com",
          pools: ["default", "read", "write"],
        },
        {
          url: "https://api-b.example.com",
          pools: ["default", "stream"],
        },
      ]),
    }));

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "https://api-a.example.com/status") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://api-a.example.com/version") {
        return new Response(JSON.stringify({ version: "1.2.3" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://api-a.example.com/health/ready") {
        return new Response(JSON.stringify({ ready: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://api-b.example.com/status") {
        throw new Error("connect ECONNREFUSED");
      }

      if (url === "https://api-b.example.com/version") {
        return new Response("bad gateway", { status: 502 });
      }

      if (url === "https://api-b.example.com/health/ready") {
        return new Response(JSON.stringify({ ready: false }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const route = await loadGetRoute("@/app/api/admin/api-upstreams/route");
    const response = await route.GET(makeRequest("/api/admin/api-upstreams"));
    const body = (await response.json()) as {
      ok: boolean;
      count: number;
      items: Array<{
        url: string;
        pools: string[];
        state: string;
        probes: Array<{ key: string; status: number | null; state: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(2);
    expect(body.items[0]?.url).toBe("https://api-a.example.com");
    expect(body.items[0]?.pools).toEqual(["default", "read", "write"]);
    expect(body.items[0]?.state).toBe("healthy");
    expect(body.items[1]?.url).toBe("https://api-b.example.com");
    expect(body.items[1]?.pools).toEqual(["default", "stream"]);
    expect(body.items[1]?.state).toBe("down");
    expect(body.items[1]?.probes.map((probe) => probe.key)).toEqual([
      "status",
      "version",
      "ready",
    ]);
  });
});
