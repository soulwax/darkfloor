// File: apps/web/src/proxy.ts

import { env } from "@/env";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const rateLimit = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 100;

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? (forwarded.split(",")[0]?.trim() ?? "127.0.0.1")
    : "127.0.0.1";
  return `${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(key);

  if (!record || now > record.resetTime) {
    rateLimit.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimit.entries()) {
    if (now > record.resetTime) {
      rateLimit.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth/");
    const rateLimitKey = getRateLimitKey(request);

    if (!isAuthRoute && !checkRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Too Many Requests" }, {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      });
    }

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
  }

  if (
    !request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/_next/")
  ) {
    const apiUrl = env.API_V2_URL;

    const apiDomain = apiUrl ? new URL(apiUrl).origin : "";
    const apiWsDomain = apiDomain
      ? apiDomain.replace(/^https?:\/\//, "wss://*.")
      : "";
    const connectSrcAllowlist = [
      "'self'",
      apiDomain,
      "https://api.starchildmusic.com",
      "https://www.darkfloor.one",
      "https://darkfloor.one",
      apiWsDomain,
    ]
      .filter(Boolean)
      .join(" ");

    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https://cdn-images.dzcdn.net https://api.deezer.com https://cdn.discordapp.com https://media.discordapp.net https://discord.com https://discordapp.com;
      font-src 'self' data:;
      connect-src ${connectSrcAllowlist};
      media-src 'self' ${apiDomain} blob:;
      worker-src 'self' blob:;
      frame-ancestors 'self';
      base-uri 'self';
      form-action 'self';
    `
      .replace(/\s{2,}/g, " ")
      .trim();

    response.headers.set("Content-Security-Policy", cspHeader);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.json|sw\\.js|icon\\.ico|icon\\.png|icon\\.icns|icon-192\\.png|icon-512\\.png|emily-the-strange\\.png).*)",
  ],
};
