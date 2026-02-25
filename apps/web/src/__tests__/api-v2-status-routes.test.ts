// File: apps/web/src/__tests__/api-v2-status-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type PostRouteHandler = (request: NextRequest) => Promise<Response>;
type MetadataRouteHandler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

type GetRouteModule = { GET: GetRouteHandler };
type PostRouteModule = { POST: PostRouteHandler };
type MetadataRouteModule = { GET: MetadataRouteHandler };
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, init);
}

async function loadGetRoute(modulePath: string): Promise<GetRouteModule> {
  return (await import(modulePath)) as unknown as GetRouteModule;
}

async function loadPostRoute(modulePath: string): Promise<PostRouteModule> {
  return (await import(modulePath)) as unknown as PostRouteModule;
}

async function loadMetadataRoute(
  modulePath: string,
): Promise<MetadataRouteModule> {
  return (await import(modulePath)) as unknown as MetadataRouteModule;
}

describe("API V2 proxy routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies all mapped routes to API_V2_URL", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://bluesixapi.com/",
        BLUESIX_API_KEY: "test-api-key",
      },
    }));
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "admin", admin: true },
      })),
    }));

    const capturedCalls: Array<{
      url: string;
      method: string;
      headers: Headers;
      body?: string;
    }> = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      capturedCalls.push({
        url,
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
      });
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const statusRoute = await loadGetRoute("@/app/api/v2/status/route");
    const versionRoute = await loadGetRoute("@/app/api/v2/version/route");
    const readyRoute = await loadGetRoute("@/app/api/v2/health/ready/route");
    const authMeRoute = await loadGetRoute("@/app/api/v2/auth/me/route");
    const authRefreshRoute = await loadGetRoute(
      "@/app/api/v2/auth/refresh/route",
    );
    const configPublicRoute = await loadGetRoute(
      "@/app/api/v2/config/public/route",
    );
    const rateLimitsRoute = await loadGetRoute("@/app/api/v2/rate-limits/route");
    const openApiRoute = await loadGetRoute("@/app/api/v2/docs/openapi/route");
    const cacheStatsRoute = await loadGetRoute("@/app/api/v2/cache/stats/route");
    const cacheClearRoute = await loadPostRoute("@/app/api/v2/cache/clear/route");
    const streamCapabilitiesRoute = await loadGetRoute(
      "@/app/api/v2/music/stream/capabilities/route",
    );
    const trackMetadataRoute = await loadMetadataRoute(
      "@/app/api/v2/music/tracks/[id]/metadata/route",
    );
    const metricsRoute = await loadGetRoute("@/app/api/v2/metrics/route");

    await statusRoute.GET(makeRequest("/api/v2/status?x=1"));
    await versionRoute.GET(makeRequest("/api/v2/version"));
    await readyRoute.GET(makeRequest("/api/v2/health/ready"));
    await authMeRoute.GET(
      makeRequest("/api/v2/auth/me", {
        headers: { authorization: "Bearer app-jwt-token" },
      }),
    );
    await authRefreshRoute.GET(makeRequest("/api/v2/auth/refresh"));
    await configPublicRoute.GET(makeRequest("/api/v2/config/public"));
    await rateLimitsRoute.GET(makeRequest("/api/v2/rate-limits"));
    await openApiRoute.GET(makeRequest("/api/v2/docs/openapi"));
    await cacheStatsRoute.GET(
      makeRequest("/api/v2/cache/stats", {
        headers: { authorization: "Bearer app-jwt-token" },
      }),
    );
    await cacheClearRoute.POST(
      makeRequest("/api/v2/cache/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
      }),
    );
    await streamCapabilitiesRoute.GET(
      makeRequest("/api/v2/music/stream/capabilities"),
    );
    await trackMetadataRoute.GET(
      makeRequest("/api/v2/music/tracks/1337/metadata"),
      { params: Promise.resolve({ id: "1337" }) },
    );
    await metricsRoute.GET(makeRequest("/api/v2/metrics"));

    const paths = capturedCalls.map((call) => new URL(call.url).pathname);
    expect(paths).toEqual([
      "/status",
      "/version",
      "/health/ready",
      "/auth/me",
      "/auth/refresh",
      "/config/public",
      "/rate-limits",
      "/docs/openapi",
      "/cache/stats",
      "/cache/clear",
      "/music/stream/capabilities",
      "/music/tracks/1337/metadata",
      "/metrics",
    ]);

    expect(new URL(capturedCalls[0]!.url).searchParams.get("x")).toBe("1");
    expect(capturedCalls[9]!.method).toBe("POST");
    expect(capturedCalls[9]!.body).toBe(JSON.stringify({ scope: "all" }));
    expect(capturedCalls[0]!.headers.get("x-api-key")).toBe("test-api-key");
    expect(capturedCalls[0]!.headers.get("authorization")).toBeNull();
    expect(capturedCalls[3]!.headers.get("authorization")).toBe(
      "Bearer app-jwt-token",
    );
    expect(capturedCalls[8]!.headers.get("authorization")).toBe(
      "Bearer app-jwt-token",
    );
  });

  it("returns 500 when API_V2_URL is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: undefined,
        BLUESIX_API_KEY: undefined,
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const statusRoute = await loadGetRoute("@/app/api/v2/status/route");

    const response = await statusRoute.GET(makeRequest("/api/v2/status"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/API_V2_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid track metadata ids", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://bluesixapi.com/",
        BLUESIX_API_KEY: "test-api-key",
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const trackMetadataRoute = await loadMetadataRoute(
      "@/app/api/v2/music/tracks/[id]/metadata/route",
    );

    const response = await trackMetadataRoute.GET(
      makeRequest("/api/v2/music/tracks/abc/metadata"),
      { params: Promise.resolve({ id: "abc" }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Invalid track ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks admin-only routes for non-admin sessions", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://bluesixapi.com/",
        BLUESIX_API_KEY: "test-api-key",
      },
    }));
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "user", admin: false },
      })),
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const cacheClearRoute = await loadPostRoute("@/app/api/v2/cache/clear/route");

    const response = await cacheClearRoute.POST(
      makeRequest("/api/v2/cache/clear", { method: "POST" }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/Admin access required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
