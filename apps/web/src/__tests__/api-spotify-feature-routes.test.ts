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

describe("Spotify public playlist routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks playlist routes when no session is present", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      UserSpotifyFeatureApiError: class UserSpotifyFeatureApiError extends Error {
        readonly status: number;

        constructor(message: string, status: number) {
          super(message);
          this.status = status;
          this.name = "UserSpotifyFeatureApiError";
        }
      },
      fetchUserSpotifyPublicPlaylistsJson: vi.fn(),
    }));

    const route = await loadGetRoute("@/app/api/spotify/playlists/route");
    const response = await route.GET(makeRequest("/api/spotify/playlists"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/sign in required/i);
  });

  it("returns settings errors when the saved Spotify profile is incomplete", async () => {
    vi.resetModules();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => {
      class UserSpotifyFeatureApiError extends Error {
        readonly status: number;

        constructor(message: string, status: number) {
          super(message);
          this.status = status;
          this.name = "UserSpotifyFeatureApiError";
        }
      }

      return {
        UserSpotifyFeatureApiError,
        fetchUserSpotifyPublicPlaylistsJson: vi.fn(async () => {
          throw new UserSpotifyFeatureApiError(
            "Spotify settings are incomplete. Save Client ID, Client Secret, and Username in Settings first.",
            412,
          );
        }),
      };
    });

    const route = await loadGetRoute("@/app/api/spotify/playlists/route");
    const response = await route.GET(makeRequest("/api/spotify/playlists"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(412);
    expect(body.error).toMatch(/settings are incomplete/i);
  });

  it("loads public playlists from the saved username and app profile", async () => {
    vi.resetModules();
    const fetchUserSpotifyPublicPlaylistsJson = vi.fn(async () => ({
      items: [{ id: "playlist-1", name: "Public Migration Set" }],
    }));

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      UserSpotifyFeatureApiError: class UserSpotifyFeatureApiError extends Error {
        readonly status: number;

        constructor(message: string, status: number) {
          super(message);
          this.status = status;
          this.name = "UserSpotifyFeatureApiError";
        }
      },
      fetchUserSpotifyPublicPlaylistsJson,
    }));

    const route = await loadGetRoute("@/app/api/spotify/playlists/route");
    const response = await route.GET(
      makeRequest("/api/spotify/playlists?limit=12&offset=24"),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      payload?: { items?: Array<{ id?: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.payload?.items?.[0]?.id).toBe("playlist-1");
    expect(fetchUserSpotifyPublicPlaylistsJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
      }),
    );

    const firstCall = fetchUserSpotifyPublicPlaylistsJson.mock.calls[0] as
      | [{ searchParams: URLSearchParams }]
      | undefined;
    expect(firstCall).toBeDefined();
    const searchParams = firstCall?.[0].searchParams;
    expect(searchParams).toBeInstanceOf(URLSearchParams);
    if (!searchParams) {
      throw new Error("searchParams were not forwarded to the helper");
    }
    expect(searchParams.toString()).toBe("limit=12&offset=24");
  });

  it("loads a public playlist detail payload", async () => {
    vi.resetModules();
    const fetchUserSpotifyPublicApiJson = vi.fn(async () => ({
      id: "playlist-1",
      name: "Public Migration Set",
      tracks: {
        items: [
          {
            track: {
              id: "track-1",
              name: "Dream Song",
            },
          },
        ],
      },
    }));

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      UserSpotifyFeatureApiError: class UserSpotifyFeatureApiError extends Error {
        readonly status: number;

        constructor(message: string, status: number) {
          super(message);
          this.status = status;
          this.name = "UserSpotifyFeatureApiError";
        }
      },
      fetchUserSpotifyPublicApiJson,
    }));

    const route = await loadMetadataRoute(
      "@/app/api/spotify/playlists/[playlistId]/route",
    );
    const response = await route.GET(
      makeRequest("/api/spotify/playlists/playlist-1"),
      { params: Promise.resolve({ playlistId: "playlist-1" }) },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      payload?: { id?: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.payload?.id).toBe("playlist-1");
    expect(fetchUserSpotifyPublicApiJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        pathname: "/playlists/playlist-1",
      }),
    );
  });
});
