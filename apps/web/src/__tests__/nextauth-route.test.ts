// File: apps/web/src/__tests__/nextauth-route.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type GetRouteHandler = (request: NextRequest) => Promise<Response>;
type PostRouteHandler = (request: NextRequest) => Promise<Response>;
type NextAuthRouteModule = {
  GET: GetRouteHandler;
  POST: PostRouteHandler;
};

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://darkfloor.org${path}`, {
    headers: {
      cookie: "authjs.session-token=session-123; theme=dark",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "darkfloor.org",
    },
  });
}

async function loadRoute(): Promise<NextAuthRouteModule> {
  return (await import("@/app/api/auth/[...nextauth]/route")) as
    | NextAuthRouteModule
    | Promise<NextAuthRouteModule>;
}

describe("NextAuth route wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("expires local auth session cookies before tracked OAuth sign-in continues", async () => {
    vi.resetModules();

    const handlerGet = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://github.com/login/oauth/authorize?client_id=test",
        },
      });
    });

    vi.doMock("@/server/auth", () => ({
      handlers: {
        GET: handlerGet,
        POST: vi.fn(),
      },
    }));

    const route = await loadRoute();
    const response = await route.GET(makeRequest("/api/auth/signin/github"), {
      params: Promise.resolve({ nextauth: ["signin", "github"] }),
    });

    expect(response.status).toBe(302);
    expect(handlerGet).toHaveBeenCalledTimes(1);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("authjs.session-token=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("__Secure-authjs.session-token=");
    expect(setCookie).toContain("__Secure-next-auth.session-token=");
  });
});
