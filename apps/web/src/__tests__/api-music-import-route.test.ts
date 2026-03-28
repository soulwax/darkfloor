// File: apps/web/src/__tests__/api-music-import-route.test.ts

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

function makeBackendTranslationResponse() {
  return {
    ok: true as const,
    playlistCreated: false,
    playlist: null,
    matchedTracks: [
      {
        index: 0,
        spotifyTrackId: "spotify-track-1",
        deezerTrackId: "101",
        deezerTrack: {
          id: 101,
          readable: true,
          title: "Track One",
          title_short: "Track One",
          link: "https://www.deezer.com/track/101",
          duration: 180,
          rank: 999,
          explicit_lyrics: false,
          explicit_content_lyrics: 0,
          explicit_content_cover: 0,
          preview: "https://cdn.example.com/preview.mp3",
          md5_image: "md5",
          artist: {
            id: 55,
            name: "Artist One",
            type: "artist",
          },
          album: {
            id: 77,
            title: "Album One",
            cover: "https://cdn.example.com/cover.jpg",
            cover_small: "https://cdn.example.com/cover-sm.jpg",
            cover_medium: "https://cdn.example.com/cover-md.jpg",
            cover_big: "https://cdn.example.com/cover-lg.jpg",
            cover_xl: "https://cdn.example.com/cover-xl.jpg",
            md5_image: "album-md5",
            tracklist: "https://api.deezer.com/album/77/tracks",
          },
          type: "track",
        },
      },
    ],
    importReport: {
      sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
      sourcePlaylistName: "Today’s Top Hits",
      totalTracks: 4,
      matchedCount: 1,
      unmatchedCount: 0,
      skippedCount: 0,
      unmatched: [],
    },
  };
}

describe("Spotify music import route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a signed-in app session before proxying imports", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn();
    const transaction = vi.fn();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => null),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));
    vi.doMock("@/lib/server/songbird-token", () => ({
      getSongbirdAccessToken: vi.fn(),
    }));
    vi.doMock("@/server/db", () => ({
      db: {
        transaction,
      },
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
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates a local Starchild playlist from backend translation results", async () => {
    vi.resetModules();
    let forwardedBody: Record<string, unknown> | null = null;
    const proxyApiV2 = vi.fn(
      async (options: {
        request?: Request;
        pathname: string;
        method?: string;
        timeoutMs?: number;
      }) => {
        forwardedBody = options.request
          ? ((await options.request.json()) as Record<string, unknown>)
          : null;

        return NextResponse.json({
          ...makeBackendTranslationResponse(),
          forwardedBody,
          pathname: options.pathname,
        });
      },
    );
    const insertedTrackRows: unknown[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        insert: vi
          .fn()
          .mockImplementationOnce(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(async () => [
                {
                  id: 321,
                  name: "Imported playlist",
                },
              ]),
            })),
          }))
          .mockImplementationOnce(() => ({
            values: vi.fn(async (rows: unknown) => {
              insertedTrackRows.push(rows);
              return rows;
            }),
          })),
      }),
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
    vi.doMock("@/server/db", () => ({
      db: {
        transaction,
      },
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
          nameOverride: "Imported playlist",
          isPublic: true,
          sourcePlaylist: {
            id: "37i9dQZF1DXcBWIGoYBM5M",
            name: "Today’s Top Hits",
            description: "Frontend snapshot",
            ownerName: "spotify",
            trackCount: 1,
            imageUrl: "https://cdn.example.com/playlist.jpg",
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
      playlist?: { id: string; name: string };
      importReport?: { matchedCount: number };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      playlist: {
        id: "321",
        name: "Imported playlist",
      },
      importReport: {
        sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
        sourcePlaylistName: "Today’s Top Hits",
        totalTracks: 4,
        matchedCount: 1,
        unmatchedCount: 0,
        skippedCount: 0,
        unmatched: [],
      },
    });
    expect(proxyApiV2).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);

    const proxyArgs = (
      proxyApiV2.mock.calls as unknown as Array<
        [{ request?: Request; pathname: string; method?: string; timeoutMs?: number }]
      >
    )[0]?.[0] as
      | { request?: Request; pathname: string }
      | undefined;

    expect(proxyArgs?.pathname).toBe("/spotify/playlists/import");
    expect(proxyArgs?.timeoutMs).toBe(90_000);
    expect(proxyArgs?.request?.headers.get("authorization")).toBe(
      "Bearer service-token-1",
    );
    expect(forwardedBody).toEqual({
      source: "spotify",
      playlistId: "37i9dQZF1DXcBWIGoYBM5M",
      targetUserId: "user-1",
      targetUserEmail: "listener@example.com",
      createPlaylist: false,
      playlistName: "Imported playlist",
      isPublic: true,
      playlist: {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        name: "Today’s Top Hits",
        description: "Frontend snapshot",
        ownerName: "spotify",
        trackCount: 1,
        imageUrl: "https://cdn.example.com/playlist.jpg",
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
        imageUrl: "https://cdn.example.com/playlist.jpg",
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
    expect(insertedTrackRows).toEqual([
      [
        expect.objectContaining({
          playlistId: 321,
          trackId: 101,
          deezerId: 101,
          position: 0,
        }),
      ],
    ]);
    const firstInsertedTrack = (
      insertedTrackRows[0] as Array<{ trackData: Record<string, unknown> }>
    )[0];
    expect(firstInsertedTrack?.trackData).toMatchObject({
      id: 101,
      title: "Track One",
      deezer_id: 101,
      spotify_id: "spotify-track-1",
    });
  });

  it("preserves caller authorization when proxying upstream imports", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn(
      async () => NextResponse.json(makeBackendTranslationResponse()),
    );
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        insert: vi
          .fn()
          .mockImplementationOnce(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(async () => [
                {
                  id: 322,
                  name: "Imported Playlist",
                },
              ]),
            })),
          }))
          .mockImplementationOnce(() => ({
            values: vi.fn(async () => undefined),
          })),
      }),
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
    vi.doMock("@/server/db", () => ({
      db: {
        transaction,
      },
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
      playlist?: { id: string; name: string };
    };

    expect(response.status).toBe(200);
    expect(body.playlist).toEqual({
      id: "322",
      name: "Imported Playlist",
    });

    const proxyArgs = (
      proxyApiV2.mock.calls as unknown as Array<
        [{ request?: Request; pathname?: string; method?: string; timeoutMs?: number }]
      >
    )[0]?.[0] as
      | { request?: Request }
      | undefined;
    expect(
      (
        proxyApiV2.mock.calls as unknown as Array<
          [
            {
              request?: Request;
              pathname?: string;
              method?: string;
              timeoutMs?: number;
            },
          ]
        >
      )[0]?.[0]?.timeoutMs,
    ).toBe(90_000);
    expect(proxyArgs?.request?.headers.get("authorization")).toBe(
      "Bearer app-token-1",
    );
  });

  it("fails clearly when the backend has not deployed the translation payload contract", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn(
      async () =>
        NextResponse.json({
          ok: true,
          playlist: {
            id: "backend-playlist-1",
            name: "Imported playlist",
          },
          importReport: {
            sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
            sourcePlaylistName: "Today’s Top Hits",
            totalTracks: 4,
            matchedCount: 1,
            unmatchedCount: 0,
            skippedCount: 0,
            unmatched: [],
          },
        }),
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
    vi.doMock("@/server/db", () => ({
      db: {
        transaction: vi.fn(),
      },
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

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/matched track payload/i);
  });
});
