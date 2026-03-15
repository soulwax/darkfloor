// File: apps/web/src/__tests__/api-auth-spotify-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type PostRouteHandler = (request: NextRequest) => Promise<Response>;
type GetRouteModule = { GET: GetRouteHandler };
type PostRouteModule = { POST: PostRouteHandler };
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`, init);
}

async function loadGetRoute(modulePath: string): Promise<GetRouteModule> {
  return (await import(modulePath)) as unknown as GetRouteModule;
}

async function loadPostRoute(modulePath: string): Promise<PostRouteModule> {
  return (await import(modulePath)) as unknown as PostRouteModule;
}

describe("Spotify auth proxy routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies canonical auth routes through API_V2_URL", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
        AUTH_DEBUG_TOKEN: "debug-token-123",
      },
    }));

    const capturedRequests: Array<{
      url: string;
      redirect: RequestRedirect | undefined;
      headers: Headers;
    }> = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      capturedRequests.push({
        url,
        redirect: init?.redirect,
        headers: new Headers(init?.headers),
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const spotifyRoute = await loadGetRoute("@/app/api/auth/spotify/route");
    const callbackRoute = await loadGetRoute(
      "@/app/api/auth/spotify/callback/route",
    );
    const refreshRoute = await loadPostRoute(
      "@/app/api/auth/spotify/refresh/route",
    );
    const meRoute = await loadGetRoute("@/app/api/auth/me/route");
    const debugRoute = await loadGetRoute("@/app/api/auth/spotify/debug/route");

    await spotifyRoute.GET(
      makeRequest(
        "/api/auth/spotify?frontend_redirect_uri=http%3A%2F%2Flocalhost%3A3222%2Fauth%2Fspotify%2Fcallback",
      ),
    );
    await callbackRoute.GET(
      makeRequest("/api/auth/spotify/callback?code=abc&state=123"),
    );
    await refreshRoute.POST(
      makeRequest("/api/auth/spotify/refresh", {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
      }),
    );
    await meRoute.GET(
      makeRequest("/api/auth/me", {
        headers: { authorization: "Bearer app-jwt-token" },
      }),
    );
    await debugRoute.GET(
      makeRequest("/api/auth/spotify/debug?trace_id=trace-1"),
    );

    const paths = capturedRequests.map(
      (request) => new URL(request.url).pathname,
    );
    expect(paths).toEqual([
      "/api/auth/spotify",
      "/api/auth/spotify/callback",
      "/api/auth/spotify/refresh",
      "/api/auth/me",
      "/api/auth/spotify/debug",
    ]);
    expect(capturedRequests.map((request) => request.redirect)).toEqual([
      "manual",
      "manual",
      "follow",
      "follow",
      "follow",
    ]);
    expect(capturedRequests[3]?.headers.get("authorization")).toBe(
      "Bearer app-jwt-token",
    );
  });

  it("bootstraps a local Auth.js session from backend-managed bearer auth", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
      },
    }));

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "local-user-1",
        email: "user@example.com",
        name: "Existing User",
        image: null,
      })
      .mockResolvedValueOnce({
        banned: false,
      });
    const insertSessionValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({
      values: insertSessionValues,
    });

    vi.doMock("@/server/db", () => ({
      db: {
        query: {
          users: {
            findFirst,
          },
        },
        insert,
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      },
    }));

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "backend-user-1",
          email: "user@example.com",
          emailVerified: true,
          name: "Existing User",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const route = await loadPostRoute("@/app/api/auth/spotify/session/route");
    const response = await route.POST(
      makeRequest("/api/auth/spotify/session", {
        method: "POST",
        headers: {
          authorization: "Bearer app-token-1",
          "x-forwarded-proto": "https",
        },
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      userId?: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("local-user-1");
    expect(findFirst).toHaveBeenCalledTimes(3);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__Secure-authjs.session-token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");

    const sessionInsertCall = insertSessionValues.mock.calls[0]?.[0] as
      | { userId?: string }
      | undefined;
    expect(sessionInsertCall?.userId).toBe("local-user-1");
  });

  it("rejects banned users before creating a local Auth.js session", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
      },
    }));

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "local-user-1",
        email: "user@example.com",
        name: "Existing User",
        image: null,
        banned: true,
      })
      .mockResolvedValueOnce({
        banned: true,
      });
    const insertSessionValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({
      values: insertSessionValues,
    });

    vi.doMock("@/server/db", () => ({
      db: {
        query: {
          users: {
            findFirst,
          },
        },
        insert,
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      },
    }));

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "backend-user-1",
          email: "user@example.com",
          emailVerified: true,
          name: "Existing User",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const route = await loadPostRoute("@/app/api/auth/spotify/session/route");
    const response = await route.POST(
      makeRequest("/api/auth/spotify/session", {
        method: "POST",
        headers: {
          authorization: "Bearer app-token-1",
          "x-forwarded-proto": "https",
        },
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/banned/i);
    expect(insertSessionValues).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not reuse an existing local user by unverified email", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
      },
    }));

    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        banned: false,
      });
    const createUserReturning = vi
      .fn()
      .mockResolvedValue([{ id: "backend-user-1" }]);
    const createUserValues = vi.fn().mockReturnValue({
      returning: createUserReturning,
    });
    const insertSessionValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        values: createUserValues,
      })
      .mockReturnValueOnce({
        values: insertSessionValues,
      });

    vi.doMock("@/server/db", () => ({
      db: {
        query: {
          users: {
            findFirst,
          },
        },
        insert,
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      },
    }));

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "backend-user-1",
          email: "user@example.com",
          emailVerified: false,
          name: "Existing User",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const route = await loadPostRoute("@/app/api/auth/spotify/session/route");
    const response = await route.POST(
      makeRequest("/api/auth/spotify/session", {
        method: "POST",
        headers: {
          authorization: "Bearer app-token-1",
          "x-forwarded-proto": "https",
        },
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      userId?: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("backend-user-1");
    expect(createUserValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "backend-user-1",
        email: "user@example.com",
        emailVerified: null,
      }),
    );
    expect(insertSessionValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "backend-user-1",
      }),
    );
  });

  it("returns 503 when AUTH_DEBUG_TOKEN is missing for debug proxy route", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
        AUTH_DEBUG_TOKEN: undefined,
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const debugRoute = await loadGetRoute("@/app/api/auth/spotify/debug/route");
    const response = await debugRoute.GET(
      makeRequest("/api/auth/spotify/debug?trace_id=trace-1"),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/AUTH_DEBUG_TOKEN/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks debug proxy route for non-admin sessions", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1", admin: false } })),
    }));
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
        AUTH_DEBUG_TOKEN: "debug-token-123",
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const debugRoute = await loadGetRoute("@/app/api/auth/spotify/debug/route");
    const response = await debugRoute.GET(
      makeRequest("/api/auth/spotify/debug?trace_id=trace-1"),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards redirect location and set-cookie headers", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: "https://api.example.com/",
      },
    }));

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "http://localhost:3222/auth/spotify/callback#access_token=abc",
          "set-cookie":
            "sb_app_refresh_token=token; Path=/; HttpOnly, sb_csrf_token=csrf; Path=/",
        },
      }),
    );

    const callbackRoute = await loadGetRoute(
      "@/app/api/auth/spotify/callback/route",
    );
    const response = await callbackRoute.GET(
      makeRequest("/api/auth/spotify/callback?code=abc&state=123"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "/auth/spotify/callback",
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb_app_refresh_token");
    expect(setCookie).toContain("sb_csrf_token");
  });

  it("returns 500 when API_V2_URL is missing", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: {
        API_V2_URL: undefined,
      },
    }));

    const fetchMock = vi.spyOn(global, "fetch");
    const meRoute = await loadGetRoute("@/app/api/auth/me/route");
    const response = await meRoute.GET(makeRequest("/api/auth/me"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/API_V2_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
