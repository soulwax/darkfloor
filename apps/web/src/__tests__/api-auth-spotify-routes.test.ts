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
      makeRequest("/api/auth/spotify?frontend_redirect_uri=http%3A%2F%2Flocalhost%3A3222%2Fauth%2Fspotify%2Fcallback"),
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
    await debugRoute.GET(makeRequest("/api/auth/spotify/debug?trace_id=trace-1"));

    const paths = capturedRequests.map((request) => new URL(request.url).pathname);
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
          location: "http://localhost:3222/auth/spotify/callback#access_token=abc",
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
    expect(response.headers.get("location")).toContain("/auth/spotify/callback");
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

  it("redirects legacy /api/auth/signin/spotify to canonical auth start", async () => {
    const legacySignInRoute = await loadGetRoute(
      "@/app/api/auth/signin/spotify/route",
    );

    const response = await legacySignInRoute.GET(
      makeRequest("/api/auth/signin/spotify?callbackUrl=%2Flibrary"),
    );

    expect(response.status).toBe(302);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location ?? "http://localhost:3222/");
    expect(redirectUrl.pathname).toBe("/api/auth/spotify");

    const frontendRedirectUri = redirectUrl.searchParams.get(
      "frontend_redirect_uri",
    );
    expect(frontendRedirectUri).toBeTruthy();

    const callbackUrl = new URL(
      frontendRedirectUri ?? "http://localhost:3222/auth/spotify/callback",
    );
    expect(callbackUrl.pathname).toBe("/auth/spotify/callback");
    expect(callbackUrl.searchParams.get("next")).toBe("/library");
  });

  it("sanitizes cross-origin callback URLs in legacy /api/auth/signin/spotify", async () => {
    const legacySignInRoute = await loadGetRoute(
      "@/app/api/auth/signin/spotify/route",
    );

    const response = await legacySignInRoute.GET(
      makeRequest(
        "/api/auth/signin/spotify?callbackUrl=https%3A%2F%2Fattacker.example%2Fsteal",
      ),
    );

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location ?? "http://localhost:3222/");
    const frontendRedirectUri = redirectUrl.searchParams.get(
      "frontend_redirect_uri",
    );
    const callbackUrl = new URL(
      frontendRedirectUri ?? "http://localhost:3222/auth/spotify/callback",
    );

    expect(callbackUrl.searchParams.get("next")).toBe("/library");
  });

  it("supports POST on legacy /api/auth/signin/spotify shim", async () => {
    const legacySignInRoute = await loadPostRoute(
      "@/app/api/auth/signin/spotify/route",
    );

    const response = await legacySignInRoute.POST(
      makeRequest("/api/auth/signin/spotify?callbackUrl=%2Fplaylists", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location ?? "http://localhost:3222/");
    const frontendRedirectUri = redirectUrl.searchParams.get(
      "frontend_redirect_uri",
    );
    const callbackUrl = new URL(
      frontendRedirectUri ?? "http://localhost:3222/auth/spotify/callback",
    );

    expect(callbackUrl.searchParams.get("next")).toBe("/playlists");
  });

  it("forwards trace query param through legacy /api/auth/signin/spotify shim", async () => {
    const legacySignInRoute = await loadGetRoute(
      "@/app/api/auth/signin/spotify/route",
    );

    const response = await legacySignInRoute.GET(
      makeRequest(
        "/api/auth/signin/spotify?callbackUrl=%2Flibrary&trace=trace-browser-1",
      ),
    );

    expect(response.status).toBe(302);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location ?? "http://localhost:3222/");
    const frontendRedirectUri = redirectUrl.searchParams.get(
      "frontend_redirect_uri",
    );
    expect(frontendRedirectUri).toBeTruthy();

    const callbackUrl = new URL(
      frontendRedirectUri ?? "http://localhost:3222/auth/spotify/callback",
    );
    expect(callbackUrl.searchParams.get("next")).toBe("/library");
    expect(callbackUrl.searchParams.get("trace")).toBe("trace-browser-1");
  });
});
