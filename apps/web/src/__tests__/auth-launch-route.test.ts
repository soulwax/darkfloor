// File: apps/web/src/__tests__/auth-launch-route.test.ts

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type LaunchRouteModule = {
  GET: (
    request: NextRequest,
    context: { params: Promise<{ provider: string }> },
  ) => Promise<Response>;
};

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://0.0.0.0:3222${path}`, {
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

  it("renders a browser-side csrf handoff page on the forwarded auth origin", async () => {
    const route = await loadRoute();

    const response = await route.GET(
      makeRequest(
        "/api/auth/launch/discord?callbackUrl=%2Fauth%2Fcallback%3Fnext%3D%252F%26provider%3Ddiscord",
      ),
      {
        params: Promise.resolve({ provider: "discord" }),
      },
    );

    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain('fetch("/api/auth/csrf"');
    expect(body).toContain('form.action = "/api/auth/signin/discord"');
    expect(body).toContain(
      'const callbackUrl = "/auth/callback?next=%2F&provider=discord";',
    );
    expect(body).toContain(
      'const fallbackUrl = "https://darkfloor.org/signin?error=AuthFailed&callbackUrl=%2Fauth%2Fcallback%3Fnext%3D%252F%26provider%3Ddiscord";',
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects unsupported providers", async () => {
    const route = await loadRoute();

    const response = await route.GET(makeRequest("/api/auth/launch/not-real"), {
      params: Promise.resolve({ provider: "not-real" }),
    });

    expect(response.status).toBe(404);
  });
});
