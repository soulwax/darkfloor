// File: apps/web/src/__tests__/api-auth-fetch-dump-routes.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type GetRouteModule = { GET: GetRouteHandler };
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function makeRequest(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`http://localhost:3222${path}`, init);
}

async function loadGetRoute(modulePath: string): Promise<GetRouteModule> {
  return (await import(modulePath)) as unknown as GetRouteModule;
}

describe("OAuth fetch dump routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires UNIVERSAL_KEY for direct dump route", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: { UNIVERSAL_KEY: "expected-key" },
    }));
    vi.doMock("@starchild/auth", () => ({
      getAuthFetchDump: vi.fn(() => []),
      getAuthLogDump: vi.fn(() => []),
      clearAuthFetchDump: vi.fn(),
      clearAuthLogDump: vi.fn(),
      isOAuthVerboseDebugEnabled: vi.fn(() => true),
    }));

    const route = await loadGetRoute("@/app/api/auth/oauth/fetch-dump/route");

    const missing = await route.GET(makeRequest("/api/auth/oauth/fetch-dump"));
    expect(missing.status).toBe(401);

    const wrong = await route.GET(
      makeRequest("/api/auth/oauth/fetch-dump", {
        headers: { "x-universal-key": "wrong-key" },
      }),
    );
    expect(wrong.status).toBe(403);

    const success = await route.GET(
      makeRequest("/api/auth/oauth/fetch-dump?fetchLimit=5&logLimit=7", {
        headers: { "x-universal-key": "expected-key" },
      }),
    );
    const body = (await success.json()) as {
      ok?: boolean;
      fetchDumpCount?: number;
      authLogCount?: number;
    };

    expect(success.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.fetchDumpCount).toBe(0);
    expect(body.authLogCount).toBe(0);
  });

  it("returns 503 when UNIVERSAL_KEY is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({
      env: { UNIVERSAL_KEY: undefined },
    }));
    vi.doMock("@starchild/auth", () => ({
      getAuthFetchDump: vi.fn(() => []),
      getAuthLogDump: vi.fn(() => []),
      clearAuthFetchDump: vi.fn(),
      clearAuthLogDump: vi.fn(),
      isOAuthVerboseDebugEnabled: vi.fn(() => false),
    }));

    const route = await loadGetRoute("@/app/api/auth/oauth/fetch-dump/route");
    const response = await route.GET(makeRequest("/api/auth/oauth/fetch-dump"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/UNIVERSAL_KEY/i);
  });

  it("admin proxy route requires admin session and can clear dumps", async () => {
    vi.resetModules();
    const clearAuthFetchDump = vi.fn();
    const clearAuthLogDump = vi.fn();

    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "admin-1", admin: true } })),
    }));
    vi.doMock("@starchild/auth", () => ({
      getAuthFetchDump: vi.fn(() => [
        {
          timestamp: "2026-02-20T06:00:00.000Z",
          label: "/api/auth/spotify/callback",
          phase: "response",
        },
      ]),
      getAuthLogDump: vi.fn(() => [
        {
          timestamp: "2026-02-20T06:00:01.000Z",
          level: "debug",
          message: "OAuth provider payload snapshot",
        },
      ]),
      clearAuthFetchDump,
      clearAuthLogDump,
      isOAuthVerboseDebugEnabled: vi.fn(() => true),
    }));

    const route = await loadGetRoute("@/app/api/admin/auth/fetch-dump/route");
    const response = await route.GET(
      makeRequest("/api/admin/auth/fetch-dump?clear=1"),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      fetchDumpCount?: number;
      authLogCount?: number;
      source?: string;
      clearAfterRead?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.source).toBe("admin-proxy");
    expect(body.fetchDumpCount).toBe(1);
    expect(body.authLogCount).toBe(1);
    expect(body.clearAfterRead).toBe(true);
    expect(clearAuthFetchDump).toHaveBeenCalledTimes(1);
    expect(clearAuthLogDump).toHaveBeenCalledTimes(1);
  });

  it("blocks admin proxy route for non-admin sessions", async () => {
    vi.resetModules();
    vi.doMock("@/server/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "user-1", admin: false } })),
    }));
    vi.doMock("@starchild/auth", () => ({
      getAuthFetchDump: vi.fn(() => []),
      getAuthLogDump: vi.fn(() => []),
      clearAuthFetchDump: vi.fn(),
      clearAuthLogDump: vi.fn(),
      isOAuthVerboseDebugEnabled: vi.fn(() => true),
    }));

    const route = await loadGetRoute("@/app/api/admin/auth/fetch-dump/route");
    const response = await route.GET(makeRequest("/api/admin/auth/fetch-dump"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin/i);
  });
});
