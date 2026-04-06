import { isEnabledOAuthProviderId } from "@/config/oauthProviders";
import { type NextRequest, NextResponse } from "next/server";

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

function buildLaunchHtml(provider: string, callbackUrl: string, fallbackUrl: string): string {
  const escapedProvider = escapeHtml(provider);
  const escapedFallbackUrl = escapeHtml(fallbackUrl);
  const escapedCsrfEndpoint = escapeHtml("/api/auth/csrf");
  const escapedSignInAction = escapeHtml(`/api/auth/signin/${provider}`);

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
      a {
        color: #dbeafe;
        text-underline-offset: 0.2em;
      }
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
      <p id="oauth-status" hidden>Preparing secure sign-in…</p>
      <noscript>
        <p>JavaScript is required to continue with OAuth on this device.</p>
        <p><a href="${escapedFallbackUrl}">Return to sign-in</a></p>
      </noscript>
    </main>
    <script>
      const callbackUrl = ${JSON.stringify(callbackUrl)};
      const fallbackUrl = ${JSON.stringify(fallbackUrl)};
      const statusNode = document.getElementById("oauth-status");

      function createHiddenInput(name, value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        return input;
      }

      async function continueOAuth() {
        statusNode?.removeAttribute("hidden");

        const response = await fetch("${escapedCsrfEndpoint}", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("csrf request failed");
        }

        const payload = await response.json();
        const csrfToken =
          typeof payload?.csrfToken === "string" ? payload.csrfToken.trim() : "";

        if (!csrfToken) {
          throw new Error("csrf token missing");
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "${escapedSignInAction}";
        form.style.display = "none";
        form.appendChild(createHiddenInput("csrfToken", csrfToken));
        form.appendChild(createHiddenInput("callbackUrl", callbackUrl));
        document.body.appendChild(form);
        form.submit();
      }

      continueOAuth().catch(() => {
        window.location.replace(fallbackUrl);
      });
    </script>
  </body>
</html>`;
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

  const origin = resolveRequestOrigin(request) ?? request.nextUrl.origin;
  const callbackUrl = normalizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
    origin,
  );
  const fallbackUrl = new URL(
    `/signin?error=AuthFailed&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    origin,
  ).toString();

  const response = new NextResponse(
    buildLaunchHtml(provider, callbackUrl, fallbackUrl),
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

  return response;
}
