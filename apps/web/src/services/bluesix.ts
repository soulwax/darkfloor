// File: apps/web/src/services/bluesix.ts

import { env } from "@/env";

const rawBluesixUrl = env.API_V2_URL;
const BLUESIX_API_URL = rawBluesixUrl
  ? rawBluesixUrl.replace(/\/+$/, "")
  : undefined;
const BLUESIX_API_KEY = env.BLUESIX_API_KEY;

async function bluesixRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (!BLUESIX_API_URL) {
    throw new Error("Bluesix API URL is not configured. Set API_V2_URL.");
  }

  if (!BLUESIX_API_KEY) {
    throw new Error(
      "Bluesix API key is not configured. Set BLUESIX_API_KEY environment variable.",
    );
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = `${BLUESIX_API_URL}${normalizedEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": BLUESIX_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Bluesix API error: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export const bluesix = {

  request: bluesixRequest,

};
