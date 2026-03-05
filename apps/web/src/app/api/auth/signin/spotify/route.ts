import { env } from "@/env";
import { buildSpotifyFrontendRedirectUri } from "@/utils/spotifyAuthRedirect";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveAuthOrigin(request: NextRequest): string {
  const configured = env.NEXT_PUBLIC_AUTH_API_ORIGIN?.trim();
  if (configured && configured.length > 0) {
    return normalizeOrigin(configured);
  }

  return request.nextUrl.origin;
}

function buildCanonicalSpotifyStartUrl(request: NextRequest): string {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const traceId = request.nextUrl.searchParams.get("trace") ?? undefined;
  const frontendRedirectUri = buildSpotifyFrontendRedirectUri({
    next: callbackUrl,
    origin: request.nextUrl.origin,
    traceId,
  });
  const redirectUrl = new URL(
    "/api/auth/spotify",
    `${resolveAuthOrigin(request)}/`,
  );
  redirectUrl.searchParams.set("frontend_redirect_uri", frontendRedirectUri);
  return redirectUrl.toString();
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(buildCanonicalSpotifyStartUrl(request), 302);
}

export async function POST(request: NextRequest) {
  return NextResponse.redirect(buildCanonicalSpotifyStartUrl(request), 303);
}
