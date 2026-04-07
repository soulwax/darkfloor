// File: apps/web/src/app/api/auth/spotify/session/route.ts

import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  logAuthDebug,
  logAuthError,
  logAuthInfo,
  logAuthWarn,
} from "@starchild/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const AUTH_ME_TIMEOUT_MS = 10_000;

type BootstrapUserProfile = {
  backendUserId: string | null;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readFirstNonEmptyString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readFirstBoolean(
  record: Record<string, unknown> | null,
  keys: string[],
): boolean | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }

  return null;
}

function decodeJwtPayload(
  accessToken: string,
): Record<string, unknown> | null {
  const segments = accessToken.split(".");
  if (segments.length < 2) return null;

  try {
    const payload = Buffer.from(segments[1] ?? "", "base64url").toString(
      "utf8",
    );
    return asRecord(JSON.parse(payload) as unknown);
  } catch {
    return null;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    return text.length > 0 ? { message: text } : {};
  }

  return response.json().catch(() => ({}));
}

function getMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim().length > 0) return message;
  const error = record.error;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return null;
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token || token.trim().length === 0) return null;
  return token.trim();
}

function normalizeBootstrapProfile(
  payload: unknown,
  accessToken: string,
): BootstrapUserProfile {
  const root = asRecord(payload);
  const nestedUser = asRecord(root?.user);
  const claims = decodeJwtPayload(accessToken);

  const backendUserId =
    readFirstNonEmptyString(root, ["userId", "id", "sub"]) ??
    readFirstNonEmptyString(nestedUser, ["userId", "id", "sub"]) ??
    readFirstNonEmptyString(claims, ["userId", "sub"]);

  const email =
    readFirstNonEmptyString(root, ["email"]) ??
    readFirstNonEmptyString(nestedUser, ["email"]) ??
    readFirstNonEmptyString(claims, ["email"]) ??
    (backendUserId ? `${backendUserId}@songbird.local` : null);
  const emailVerified =
    readFirstBoolean(root, ["emailVerified", "email_verified", "verified"]) ??
    readFirstBoolean(nestedUser, [
      "emailVerified",
      "email_verified",
      "verified",
    ]) ??
    readFirstBoolean(claims, ["emailVerified", "email_verified", "verified"]) ??
    false;

  const name =
    readFirstNonEmptyString(root, ["name", "displayName", "username"]) ??
    readFirstNonEmptyString(nestedUser, ["name", "displayName", "username"]) ??
    (email ? email.split("@")[0] ?? null : null);

  const image =
    readFirstNonEmptyString(root, [
      "image",
      "imageUrl",
      "avatarUrl",
      "picture",
      "profileImage",
    ]) ??
    readFirstNonEmptyString(nestedUser, [
      "image",
      "imageUrl",
      "avatarUrl",
      "picture",
      "profileImage",
    ]);

  if (!email || !backendUserId) {
    throw new Error("Backend auth profile did not include stable user identity");
  }

  return {
    backendUserId,
    email,
    emailVerified,
    name,
    image,
  };
}

async function fetchBootstrapProfile(
  accessToken: string,
): Promise<BootstrapUserProfile> {
  if (getApiV2BaseUrls().length === 0) {
    throw new Error("API_V2_URL is not configured");
  }

  const { response, upstreamUrl } = await fetchApiV2WithFailover({
    pathname: "/api/auth/me",
    timeoutMs: AUTH_ME_TIMEOUT_MS,
    init: {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const message =
      getMessageFromBody(body) ??
      `GET ${upstreamUrl} failed with status ${response.status}`;
    throw new Error(message);
  }

  return normalizeBootstrapProfile(body, accessToken);
}

async function resolveOrCreateLocalUser(
  profile: BootstrapUserProfile,
): Promise<string> {
  const backendUserId = profile.backendUserId;
  if (!backendUserId) {
    throw new Error("Backend auth profile did not include a user id");
  }
  const email = profile.email ?? `${backendUserId}@songbird.local`;

  const byBackendId = await db.query.users.findFirst({
    where: eq(users.id, backendUserId),
  });
  const existingUser = byBackendId;
  if (existingUser) {
    const updates: Partial<typeof users.$inferInsert> = {};
    if (profile.emailVerified && email !== existingUser.email) {
      updates.email = email;
    }
    if (profile.emailVerified && !existingUser.emailVerified) {
      updates.emailVerified = new Date();
    }
    if (profile.name && profile.name !== existingUser.name) {
      updates.name = profile.name;
    }
    if (profile.image && profile.image !== existingUser.image) {
      updates.image = profile.image;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, existingUser.id));
    }
    return existingUser.id;
  }

  const inserted = await db
    .insert(users)
    .values({
      id: backendUserId,
      email,
      emailVerified: profile.emailVerified ? new Date() : null,
      name: profile.name,
      image: profile.image,
    })
    .returning({ id: users.id });

  const createdUser = inserted[0];
  if (!createdUser) {
    throw new Error("Failed to create local user for backend-managed auth");
  }

  return createdUser.id;
}

function shouldUseSecureCookies(request: NextRequest): boolean {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;

  return request.nextUrl.protocol === "https:";
}

function getSessionCookieName(useSecureCookies: boolean): string {
  return `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`;
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Missing Authorization: Bearer <access_token>" },
      { status: 401 },
    );
  }

  logAuthDebug("Backend-managed auth session bootstrap requested", {
    requestOrigin: request.headers.get("origin") ?? null,
    requestPath: request.nextUrl.pathname,
    secureCookies: shouldUseSecureCookies(request),
  });

  try {
    const profile = await fetchBootstrapProfile(accessToken);
    const localUserId = await resolveOrCreateLocalUser(profile);
    const localUser = await db.query.users.findFirst({
      where: eq(users.id, localUserId),
      columns: {
        banned: true,
      },
    });

    if (localUser?.banned) {
      logAuthWarn(
        "Backend-managed auth session bootstrap denied because user is banned",
        {
          backendUserId: profile.backendUserId,
          localUserId,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Your account has been banned. If you believe this is an error, please contact support.",
        },
        {
          status: 403,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const sessionToken = randomUUID();
    const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await db.insert(sessions).values({
      sessionToken,
      userId: localUserId,
      expires,
    });

    const response = NextResponse.json(
      {
        ok: true,
        userId: localUserId,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );

    response.cookies.set({
      name: getSessionCookieName(shouldUseSecureCookies(request)),
      value: sessionToken,
      expires,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: shouldUseSecureCookies(request),
    });

    logAuthInfo("Backend-managed auth session bootstrapped", {
      backendUserId: profile.backendUserId,
      localUserId,
      hasEmail: Boolean(profile.email),
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to bootstrap backend-managed auth session";

    logAuthError("Backend-managed auth session bootstrap failed", {
      error,
      requestPath: request.nextUrl.pathname,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
