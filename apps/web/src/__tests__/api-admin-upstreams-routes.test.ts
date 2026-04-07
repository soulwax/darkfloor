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
      apiV2UpstreamInternals: {
        clearState: vi.fn(),
        getStateSnapshot: vi.fn(() => ({
          cooldowns: {},
          metricsByUrl: {},
          nextCursorByPool: {},
        })),
      },
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
          poolWeights: { default: 5, read: 7, write: 9 },
        },
        {
          url: "https://api-b.example.com",
          pools: ["default", "stream"],
          poolWeights: { default: 2, stream: 4 },
        },
      ]),
      apiV2UpstreamInternals: {
        clearState: vi.fn(),
        getStateSnapshot: vi.fn(() => ({
          cooldowns: {
            "https://api-b.example.com": Date.now() + 15_000,
          },
          metricsByUrl: {
            "https://api-a.example.com": {
              selectionCount: 12,
              selectionCountByPool: { read: 8, write: 4 },
              successCount: 11,
              failureCount: 1,
              lastSelectedAt: Date.now() - 1_000,
              lastSuccessAt: Date.now() - 1_000,
              lastFailureAt: Date.now() - 30_000,
              lastFailureReason: "status_503",
            },
            "https://api-b.example.com": {
              selectionCount: 3,
              selectionCountByPool: { stream: 3 },
              successCount: 0,
              failureCount: 3,
              lastSelectedAt: Date.now() - 5_000,
              lastSuccessAt: null,
              lastFailureAt: Date.now() - 5_000,
              lastFailureReason: "connect ECONNREFUSED",
            },
          },
          nextCursorByPool: {},
        })),
      },
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
        routing: {
          poolWeights: Record<string, number>;
          cooldownRemainingMs: number;
          selectionCount: number;
          lastFailureReason: string | null;
        };
        probes: Array<{ key: string; status: number | null; state: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(2);
    expect(body.items[0]?.url).toBe("https://api-a.example.com");
    expect(body.items[0]?.pools).toEqual(["default", "read", "write"]);
    expect(body.items[0]?.state).toBe("healthy");
    expect(body.items[0]?.routing.poolWeights).toEqual({
      default: 5,
      read: 7,
      write: 9,
    });
    expect(body.items[0]?.routing.selectionCount).toBe(12);
    expect(body.items[1]?.url).toBe("https://api-b.example.com");
    expect(body.items[1]?.pools).toEqual(["default", "stream"]);
    expect(body.items[1]?.state).toBe("down");
    expect(body.items[1]?.routing.cooldownRemainingMs).toBeGreaterThan(0);
    expect(body.items[1]?.routing.lastFailureReason).toMatch(/ECONNREFUSED/);
    expect(body.items[1]?.probes.map((probe) => probe.key)).toEqual([
      "status",
      "version",
      "ready",
    ]);
  });
});
