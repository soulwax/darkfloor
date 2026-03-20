// File: apps/web/src/__tests__/api-admin-spotify-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type MetadataRouteHandler = (
  request: NextRequest,
  context: { params: Promise<{ playlistId: string }> },
) => Promise<Response>;

type GetRouteModule = { GET: GetRouteHandler };
type MetadataRouteModule = { GET: MetadataRouteHandler };
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`, init);
}

async function loadGetRoute(modulePath: string): Promise<GetRouteModule> {
  return (await import(modulePath)) as unknown as GetRouteModule;
}

async function loadMetadataRoute(
  modulePath: string,
): Promise<MetadataRouteModule> {
  return (await import(modulePath)) as unknown as MetadataRouteModule;
}

describe("Admin Spotify proxy routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies Spotify admin routes through API_V2_URL", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://songbirdapi.example/",
        BLUESIX_API_KEY: "test-api-key",
      },
    }));
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "admin-1", admin: true },
      })),
    }));

    const capturedCalls: Array<{
      url: string;
      headers: Headers;
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
        headers: new Headers(init?.headers),
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const statusRoute = await loadGetRoute(
      "@/app/api/admin/spotify/auth/status/route",
    );
    const playlistsRoute = await loadGetRoute(
      "@/app/api/admin/spotify/playlists/route",
    );
    const playlistDetailRoute = await loadMetadataRoute(
      "@/app/api/admin/spotify/playlists/[playlistId]/route",
    );

    await statusRoute.GET(
      makeRequest("/api/admin/spotify/auth/status", {
        headers: { authorization: "Bearer app-token-1" },
      }),
    );
    await playlistsRoute.GET(
      makeRequest("/api/admin/spotify/playlists?limit=24", {
        headers: { authorization: "Bearer app-token-1" },
      }),
    );
    await playlistDetailRoute.GET(
      makeRequest("/api/admin/spotify/playlists/37i9", {
        headers: { authorization: "Bearer app-token-1" },
      }),
      { params: Promise.resolve({ playlistId: "37i9" }) },
    );

    const paths = capturedCalls.map((call) => new URL(call.url).pathname);
    expect(paths).toEqual([
      "/spotify/auth/status",
      "/spotify/playlists",
      "/spotify/playlists/37i9",
    ]);
    expect(new URL(capturedCalls[1]!.url).searchParams.get("limit")).toBe("24");
    expect(capturedCalls[0]!.headers.get("authorization")).toBe(
      "Bearer app-token-1",
    );
  });

  it("blocks Spotify admin routes for non-admin sessions", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://songbirdapi.example/",
        BLUESIX_API_KEY: "test-api-key",
      },
    }));
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "user-1", admin: false },
      })),
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const statusRoute = await loadGetRoute(
      "@/app/api/admin/spotify/auth/status/route",
    );

    const response = await statusRoute.GET(
      makeRequest("/api/admin/spotify/auth/status"),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin access required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
