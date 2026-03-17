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
    vi.doMock("@/lib/server/songbird-token", () => ({
      getSongbirdAccessToken: vi.fn(),
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

  it("allows signed-in users to proxy imports without backend bearer auth", async () => {
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
      auth: vi.fn(async () => ({
        user: { id: "user-1", email: "listener@example.com" },
      })),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      getSongbirdAccessToken: vi.fn(async () => ({
        accessToken: "service-token-1",
        tokenType: "Bearer",
        expiresIn: 300,
        expiresAt: Date.now() + 300_000,
        scopes: ["spotify.playlists.import:write"],
      })),
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
          sourcePlaylist: {
            id: "37i9dQZF1DXcBWIGoYBM5M",
            name: "Today’s Top Hits",
            description: "Frontend snapshot",
            ownerName: "spotify",
            trackCount: 1,
            tracks: [
              {
                index: 0,
                spotifyTrackId: "spotify-track-1",
                name: "Track One",
                artist: "Artist One",
                artists: ["Artist One"],
                albumName: "Album One",
                durationMs: 180000,
                externalUrl: "https://open.spotify.com/track/spotify-track-1",
              },
            ],
          },
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
    expect(body.authorization).toBe("Bearer service-token-1");
    expect(body.body).toEqual({
      source: "spotify",
      playlistId: "37i9dQZF1DXcBWIGoYBM5M",
      targetUserId: "user-1",
      targetUserEmail: "listener@example.com",
      createPlaylist: true,
      playlist: {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        name: "Today’s Top Hits",
        description: "Frontend snapshot",
        ownerName: "spotify",
        trackCount: 1,
        tracks: [
          {
            index: 0,
            spotifyTrackId: "spotify-track-1",
            name: "Track One",
            artist: "Artist One",
            artists: ["Artist One"],
            albumName: "Album One",
            durationMs: 180000,
            externalUrl: "https://open.spotify.com/track/spotify-track-1",
          },
        ],
      },
      sourcePlaylist: {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        name: "Today’s Top Hits",
        description: "Frontend snapshot",
        ownerName: "spotify",
        trackCount: 1,
        tracks: [
          {
            index: 0,
            spotifyTrackId: "spotify-track-1",
            name: "Track One",
            artist: "Artist One",
            artists: ["Artist One"],
            albumName: "Album One",
            durationMs: 180000,
            externalUrl: "https://open.spotify.com/track/spotify-track-1",
          },
        ],
      },
    });
    expect(proxyApiV2).toHaveBeenCalledTimes(1);
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
      auth: vi.fn(async () => ({
        user: {
          id: "user-1",
          email: "listener@example.com",
          name: "Listener",
          image: "https://cdn.example.com/avatar.png",
        },
      })),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      getSongbirdAccessToken: vi.fn(),
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
      source: "spotify",
      playlistId: "37i9dQZF1DXcBWIGoYBM5M",
      targetUserId: "user-1",
      targetUserEmail: "listener@example.com",
      targetUserName: "Listener",
      targetUserProfileImage: "https://cdn.example.com/avatar.png",
      createPlaylist: true,
      playlistName: "Imported playlist",
      isPublic: true,
    });
    expect(proxyApiV2).toHaveBeenCalledTimes(1);
  });
});
