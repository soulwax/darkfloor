import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type PostRouteHandler = (request: NextRequest) => Promise<Response>;
type PostRouteModule = { POST: PostRouteHandler };
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`, init);
}

async function loadPostRoute(modulePath: string): Promise<PostRouteModule> {
  return (await import(modulePath)) as unknown as PostRouteModule;
}

describe("Spotify music import route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a signed-in app session before proxying imports", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => null),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));

    const route = await loadPostRoute(
      "@/app/api/music/playlists/import/spotify/route",
    );
    const response = await route.POST(
      makeRequest("/api/music/playlists/import/spotify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          spotifyPlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
        }),
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/sign in required/i);
    expect(proxyApiV2).not.toHaveBeenCalled();
  });

  it("preserves caller authorization when proxying upstream imports", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn(
      async (options: {
        request?: Request;
        pathname: string;
        method?: string;
        timeoutMs?: number;
      }) => {
        const forwardedBody = options.request
          ? ((await options.request.json()) as Record<string, unknown>)
          : null;

        return NextResponse.json({
          ok: true,
          pathname: options.pathname,
          authorization: options.request?.headers.get("authorization"),
          method: options.method,
          timeoutMs: options.timeoutMs,
          body: forwardedBody,
        });
      },
    );

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));

    const route = await loadPostRoute(
      "@/app/api/music/playlists/import/spotify/route",
    );
    const response = await route.POST(
      makeRequest("/api/music/playlists/import/spotify", {
        method: "POST",
        headers: {
          authorization: "Bearer app-token-1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          spotifyPlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
          nameOverride: "Imported playlist",
          isPublic: true,
        }),
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      pathname?: string;
      authorization?: string | null;
      body?: Record<string, unknown> | null;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.pathname).toBe("/spotify/playlists/import");
    expect(body.authorization).toBe("Bearer app-token-1");
    expect(body.body).toEqual({
      playlistId: "37i9dQZF1DXcBWIGoYBM5M",
      createPlaylist: true,
      playlistName: "Imported playlist",
      isPublic: true,
    });
    expect(proxyApiV2).toHaveBeenCalledTimes(1);
  });
});
