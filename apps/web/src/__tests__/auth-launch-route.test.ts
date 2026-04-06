// File: apps/web/src/__tests__/auth-launch-route.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type LaunchRouteModule = {
  authLaunchInternals: {
    getCsrfResponse: (request: NextRequest) => Promise<Response>;
  };
  GET: (
    request: NextRequest,
    context: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;
};

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://darkfloor.org${path}`, {
    headers: {
      cookie: "theme=dark",
      "user-agent": "Vitest",
      "x-forwarded-host": "darkfloor.org",
      "x-forwarded-proto": "https",
    },
  });
}

async function loadRoute(): Promise<LaunchRouteModule> {
  return (await import("@/app/api/auth/launch/[provider]/route")) as
    | LaunchRouteModule
    | Promise<LaunchRouteModule>;
}

describe("auth launch route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("renders the auto-submit handoff form using an internally resolved csrf token", async () => {
    vi.doMock("@/server/auth", () => ({
      handlers: {
        GET: vi.fn(),
        POST: vi.fn(),
      },
    }));

    const route = await loadRoute();
    const handlerGet = vi
      .spyOn(route.authLaunchInternals, "getCsrfResponse")
      .mockImplementation(async (request: NextRequest) => {
        expect(new URL(request.url).pathname).toBe("/api/auth/launch/discord");
        expect(request.headers.get("x-forwarded-host")).toBe("darkfloor.org");
        expect(request.headers.get("x-forwarded-proto")).toBe("https");
        return new Response(JSON.stringify({ csrfToken: "csrf-token-1" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie":
              "__Host-authjs.csrf-token=csrf-cookie; Path=/; HttpOnly; Secure; SameSite=Lax",
          },
        });
      });

    const response = await route.GET(
      makeRequest(
        "/api/auth/launch/discord?callbackUrl=%2Fauth%2Fcallback%3Fnext%3D%252F%26provider%3Ddiscord",
      ),
      {
        params: Promise.resolve({ provider: "discord" }),
      },
    );

    expect(response.status).toBe(200);
    expect(handlerGet).toHaveBeenCalledTimes(1);

    const body = await response.text();
    expect(body).toContain('action="/api/auth/signin/discord"');
    expect(body).toContain('name="csrfToken" value="csrf-token-1"');
    expect(body).toContain(
      'name="callbackUrl" value="/auth/callback?next=%2F&amp;provider=discord"',
    );
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-authjs.csrf-token=csrf-cookie",
    );
  });

  it("redirects back to sign-in when csrf resolution throws", async () => {
    vi.doMock("@/server/auth", () => ({
      handlers: {
        GET: vi.fn(),
        POST: vi.fn(),
      },
    }));

    const route = await loadRoute();
    const handlerGet = vi
      .spyOn(route.authLaunchInternals, "getCsrfResponse")
      .mockImplementation(async () => {
        throw new Error("csrf failed");
      });

    const response = await route.GET(makeRequest("/api/auth/launch/discord"), {
      params: Promise.resolve({ provider: "discord" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://darkfloor.org/signin?error=AuthFailed&callbackUrl=%2F",
    );
  });
});
