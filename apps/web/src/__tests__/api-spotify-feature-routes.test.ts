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

describe("Spotify playlist auth status route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks playlist auth status checks when no session is present", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => null),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));

    const route = await loadGetRoute("@/app/api/spotify/auth/status/route");
    const response = await route.GET(makeRequest("/api/spotify/auth/status"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/sign in required/i);
    expect(proxyApiV2).not.toHaveBeenCalled();
  });

  it("reports missing playlist auth before proxying upstream", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));

    const route = await loadGetRoute("@/app/api/spotify/auth/status/route");
    const response = await route.GET(makeRequest("/api/spotify/auth/status"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/playlist auth is not connected/i);
    expect(proxyApiV2).not.toHaveBeenCalled();
  });

  it("forwards backend bearer auth when checking playlist auth status", async () => {
    vi.resetModules();
    const proxyApiV2 = vi.fn(
      async (options: {
        request?: Request;
        pathname: string;
        method?: string;
        timeoutMs?: number;
      }) =>
        new Response(
          JSON.stringify({
            ok: true,
            pathname: options.pathname,
            authorization: options.request?.headers.get("authorization"),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
    );

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/app/api/v2/_lib", () => ({
      proxyApiV2,
    }));

    const route = await loadGetRoute("@/app/api/spotify/auth/status/route");
    const response = await route.GET(
      makeRequest("/api/spotify/auth/status", {
        headers: {
          authorization: "Bearer app-token-1",
        },
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      pathname?: string;
      authorization?: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.pathname).toBe("/spotify/auth/status");
    expect(body.authorization).toBe("Bearer app-token-1");
    expect(proxyApiV2).toHaveBeenCalledTimes(1);
  });
});

describe("Spotify credential test route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks the credential test route when no session is present", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      testUserSpotifyFeatureCredentials: vi.fn(),
    }));

    const route = await loadGetRoute(
      "@/app/api/spotify/credentials/test/route",
    );
    const response = await route.GET(
      makeRequest("/api/spotify/credentials/test"),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/sign in required/i);
  });

  it("returns safe diagnostics when the saved Spotify profile is incomplete", async () => {
    vi.resetModules();
    const testUserSpotifyFeatureCredentials = vi.fn(async () => ({
      ok: false as const,
      status: 412,
      message:
        "Spotify settings are incomplete. Save Client ID, Client Secret, and Username in Settings first.",
      code: "settings_incomplete",
      diagnostics: {
        enabled: false,
        username: "",
        clientIdPreview: "",
        clientSecretLength: 0,
      },
    }));

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      testUserSpotifyFeatureCredentials,
    }));

    const route = await loadGetRoute(
      "@/app/api/spotify/credentials/test/route",
    );
    const response = await route.GET(
      makeRequest("/api/spotify/credentials/test"),
    );
    const body = (await response.json()) as {
      error?: string;
      code?: string;
      diagnostics?: {
        clientSecretLength?: number;
      };
    };

    expect(response.status).toBe(412);
    expect(body.error).toMatch(/settings are incomplete/i);
    expect(body.code).toBe("settings_incomplete");
    expect(body.diagnostics?.clientSecretLength).toBe(0);
    expect(testUserSpotifyFeatureCredentials).toHaveBeenCalledWith("user-1");
  });

  it("confirms the saved Spotify credentials when app token validation succeeds", async () => {
    vi.resetModules();
    const testUserSpotifyFeatureCredentials = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      message:
        "Spotify app credentials were accepted. Public playlist access should be ready.",
      code: null,
      diagnostics: {
        enabled: true,
        username: "soulwax",
        clientIdPreview: "abcd...wxyz",
        clientSecretLength: 32,
      },
    }));

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    }));
    vi.doMock("@/lib/server/userSpotifyFeatureApi", () => ({
      testUserSpotifyFeatureCredentials,
    }));

    const route = await loadGetRoute(
      "@/app/api/spotify/credentials/test/route",
    );
    const response = await route.GET(
      makeRequest("/api/spotify/credentials/test"),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      message?: string;
      checkedAt?: string;
      diagnostics?: {
        username?: string;
        clientIdPreview?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/accepted/i);
    expect(body.checkedAt).toBeTruthy();
    expect(body.diagnostics?.username).toBe("soulwax");
    expect(body.diagnostics?.clientIdPreview).toBe("abcd...wxyz");
    expect(testUserSpotifyFeatureCredentials).toHaveBeenCalledWith("user-1");
  });
});
