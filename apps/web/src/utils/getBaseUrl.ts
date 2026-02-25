// File: apps/web/src/utils/getBaseUrl.ts

import { env } from "@/env";
import { headers } from "next/headers";

const LOCAL_FALLBACK_BASE_URL = "http://127.0.0.1:3222";

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;

  const configuredUrl = normalizeOrigin(env.NEXTAUTH_URL);
  if (configuredUrl) return configuredUrl;

  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost && vercelHost.trim().length > 0) {
    return `https://${vercelHost}`;
  }

  return LOCAL_FALLBACK_BASE_URL;
}

export async function getRequestBaseUrl(): Promise<string> {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  if (host) return `${protocol}://${host}`;
  return getBaseUrl();
}
