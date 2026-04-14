// File: apps/web/src/__tests__/api-admin-upstreams-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type GetRouteModule = { GET: GetRouteHandler };

function makeRequest(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`, init);
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
    vi.doMock("@/env", () => ({
      env: {
        API_HUB_URL: "https://ld.songbirdapi.com",
        BLUESIX_API_KEY: undefined,
        UNIVERSAL_KEY: undefined,
      },
    }));

    const route = await loadGetRoute("@/app/api/admin/api-upstreams/route");
    const response = await route.GET(makeRequest("/api/admin/api-upstreams"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });

  it("fetches detailed cluster diagnostics from the centralized hub and normalizes the response", async () => {
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@/env", () => ({
      env: {
        API_HUB_URL: "https://ld.songbirdapi.com",
        BLUESIX_API_KEY: "service-token",
        UNIVERSAL_KEY: undefined,
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "https://ld.songbirdapi.com/api/v2/ops/cluster/servers") {
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe("Bearer browser-token");
        expect(headers.get("x-api-key")).toBe("service-token");

        return new Response(
          JSON.stringify({
            timestamp: "2026-04-14T12:00:00.000Z",
            localVersion: "2.4.0",
            localUrl: "https://ld.songbirdapi.com",
            referenceUrl: "https://ld.songbirdapi.com",
            total: 3,
            healthyCount: 1,
            inSyncCount: 2,
            nodes: [
              {
                url: "https://node-ok.songbirdapi.com",
                status: "ok",
                version: "2.4.0",
                httpStatus: 200,
                responseTimeMs: 120,
                nodeEnv: "production",
                isVercel: false,
                inSync: true,
                isSelf: true,
                fetchedAt: "2026-04-14T12:00:00.000Z",
                requestedUrl: "https://node-ok.songbirdapi.com/api/v2/status",
                publicConfig: {
                  app: { name: "Songbird API", version: "2.4.0" },
                  environment: {
                    nodeVersion: "v22.15.0",
                    isNetlify: false,
                  },
                  urls: { appUrl: "https://node-ok.songbirdapi.com" },
                  cors: {
                    origins: ["https://darkfloor.org"],
                    note: "central hub",
                  },
                },
              },
              {
                url: "https://node-drift.songbirdapi.com",
                status: "ok",
                version: "2.3.9",
                httpStatus: 200,
                responseTimeMs: 180,
                nodeEnv: "production",
                isVercel: true,
                inSync: false,
                isSelf: false,
                fetchedAt: "2026-04-14T12:00:01.000Z",
                requestedUrl: "https://node-drift.songbirdapi.com/api/v2/status",
                publicConfig: null,
              },
              {
                url: "https://node-down.songbirdapi.com",
                status: "error",
                version: null,
                httpStatus: 503,
                responseTimeMs: 990,
                nodeEnv: "production",
                isVercel: false,
                inSync: false,
                isSelf: false,
                fetchedAt: "2026-04-14T12:00:02.000Z",
                requestedUrl: "https://node-down.songbirdapi.com/api/v2/status",
                error: "upstream timeout",
                publicConfig: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const route = await loadGetRoute("@/app/api/admin/api-upstreams/route");
    const response = await route.GET(
      makeRequest("/api/admin/api-upstreams", {
        headers: { authorization: "Bearer browser-token" },
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      diagnostics: {
        baseUrl: string;
        total: number;
        healthyCount: number;
        inSyncCount: number;
        localVersion: string | null;
        nodes: Array<{
          url: string;
          state: string;
          publicConfig: { app: { name: string | null } } | null;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.diagnostics.baseUrl).toBe("https://ld.songbirdapi.com");
    expect(body.diagnostics.total).toBe(3);
    expect(body.diagnostics.healthyCount).toBe(1);
    expect(body.diagnostics.inSyncCount).toBe(2);
    expect(body.diagnostics.localVersion).toBe("2.4.0");
    expect(body.diagnostics.nodes.map((node) => node.url)).toEqual([
      "https://node-down.songbirdapi.com",
      "https://node-drift.songbirdapi.com",
      "https://node-ok.songbirdapi.com",
    ]);
    expect(body.diagnostics.nodes[0]?.state).toBe("unhealthy");
    expect(body.diagnostics.nodes[1]?.state).toBe("out-of-sync");
    expect(body.diagnostics.nodes[2]?.publicConfig?.app.name).toBe(
      "Songbird API",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the alternate detailed path and public summary when needed", async () => {
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@/env", () => ({
      env: {
        API_HUB_URL: "https://ld.songbirdapi.com",
        BLUESIX_API_KEY: undefined,
        UNIVERSAL_KEY: undefined,
      },
    }));

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "https://ld.songbirdapi.com/api/v2/ops/cluster/servers") {
        return new Response("missing", { status: 404 });
      }

      if (url === "https://ld.songbirdapi.com/ops/cluster/servers") {
        return new Response(
          JSON.stringify({ error: "forbidden" }),
          {
            status: 403,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "https://ld.songbirdapi.com/cluster/sync") {
        return new Response(
          JSON.stringify({
            timestamp: "2026-04-14T12:30:00.000Z",
            localVersion: "2.4.0",
            referenceUrl: "https://ld.songbirdapi.com",
            total: 2,
            healthyCount: 1,
            inSyncCount: 1,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const route = await loadGetRoute("@/app/api/admin/api-upstreams/route");
    const response = await route.GET(makeRequest("/api/admin/api-upstreams"));
    const body = (await response.json()) as {
      ok: boolean;
      error: string;
      diagnostics?: {
        total: number;
        nodes: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/403/);
    expect(body.diagnostics?.total).toBe(2);
    expect(body.diagnostics?.nodes).toEqual([]);
  });
});
