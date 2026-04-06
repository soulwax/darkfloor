import { handlers } from "@/server/auth";
import { isEnabledOAuthProviderId } from "@/config/oauthProviders";
import { type NextRequest, NextResponse } from "next/server";

type CsrfResponse = {
  csrfToken?: string;
};

function resolveRequestOrigin(request: Request): string | null {
  try {
    const fallback = new URL(request.url);
    const hostHeader =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protoHeader =
      request.headers.get("x-forwarded-proto") ??
      fallback.protocol.replace(":", "");

    if (!hostHeader) return fallback.origin;
    return new URL(`${protoHeader}://${hostHeader}`).origin;
  } catch {
    return null;
  }
}

function applyDynamicAuthOrigin(request: Request): void {
  const requestOrigin = resolveRequestOrigin(request);
  if (!requestOrigin) return;

  process.env.AUTH_URL = requestOrigin;
  process.env.NEXTAUTH_URL = requestOrigin;
  process.env.NEXTAUTH_URL_INTERNAL = requestOrigin;
}

function splitSetCookieHeader(value: string): string[] {
  return value
    .split(/,(?=\s*[^;,=\s]+=)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie().filter(Boolean);
  }

  const raw = headers.get("set-cookie");
  return raw ? splitSetCookieHeader(raw) : [];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCallbackUrl(callbackUrl: string | null, origin: string): string {
  if (!callbackUrl) return "/";
  if (callbackUrl.startsWith("/")) return callbackUrl;

  try {
    const parsed = new URL(callbackUrl);
    if (parsed.origin !== origin) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

function buildLaunchHtml(provider: string, csrfToken: string, callbackUrl: string): string {
  const escapedProvider = escapeHtml(provider);
  const escapedCsrfToken = escapeHtml(csrfToken);
  const escapedCallbackUrl = escapeHtml(callbackUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Signing in...</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #070b12;
        color: rgba(255,255,255,0.92);
        font: 16px/1.5 system-ui, sans-serif;
      }
      main {
        width: min(28rem, calc(100vw - 2rem));
        padding: 1.5rem;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.9);
        text-align: center;
      }
      p { margin: 0; color: rgba(255,255,255,0.72); }
      button {
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        border: 0;
        border-radius: 0.875rem;
        background: #5865f2;
        color: white;
        font: inherit;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Continuing to ${escapedProvider} sign-in…</p>
      <form id="oauth-launch" method="POST" action="/api/auth/signin/${escapedProvider}">
        <input type="hidden" name="csrfToken" value="${escapedCsrfToken}" />
        <input type="hidden" name="callbackUrl" value="${escapedCallbackUrl}" />
        <noscript><button type="submit">Continue</button></noscript>
      </form>
    </main>
    <script>document.getElementById("oauth-launch")?.submit();</script>
  </body>
</html>`;
}

async function getCsrfResponse(request: NextRequest): Promise<Response> {
  applyDynamicAuthOrigin(request);

  const csrfUrl = new URL("/api/auth/csrf", request.url);
  const csrfHeaders = new Headers();
  csrfHeaders.set("accept", "application/json");
  csrfHeaders.set("cookie", request.headers.get("cookie") ?? "");
  csrfHeaders.set("user-agent", request.headers.get("user-agent") ?? "");
  csrfHeaders.set(
    "x-forwarded-host",
    request.headers.get("x-forwarded-host") ?? request.nextUrl.host,
  );
  csrfHeaders.set(
    "x-forwarded-proto",
    request.headers.get("x-forwarded-proto") ??
      request.nextUrl.protocol.replace(":", ""),
  );

  const csrfRequest = new NextRequest(csrfUrl.toString(), {
    method: "GET",
    headers: csrfHeaders,
  });

  return handlers.GET(csrfRequest);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!isEnabledOAuthProviderId(provider)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported OAuth provider" },
      { status: 404 },
    );
  }

  const origin = request.nextUrl.origin;
  const callbackUrl = normalizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
    origin,
  );

  let csrfResponse: Response;
  try {
    csrfResponse = await getCsrfResponse(request);
  } catch {
    return NextResponse.redirect(
      new URL(
        `/signin?error=AuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        origin,
      ),
    );
  }

  if (!csrfResponse.ok) {
    return NextResponse.redirect(
      new URL(
        `/signin?error=AuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        origin,
      ),
    );
  }

  const payload = (await csrfResponse.json()) as CsrfResponse;
  const csrfToken = payload.csrfToken?.trim();

  if (!csrfToken) {
    return NextResponse.redirect(
      new URL(
        `/signin?error=AuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        origin,
      ),
    );
  }

  const response = new NextResponse(
    buildLaunchHtml(provider, csrfToken, callbackUrl),
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        pragma: "no-cache",
        expires: "0",
        "surrogate-control": "no-store",
      },
    },
  );

  for (const cookie of getSetCookieHeaders(csrfResponse.headers)) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
