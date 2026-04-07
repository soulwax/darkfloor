// File: apps/web/src/services/bluesix.ts

import { env } from "@/env";
import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";

const BLUESIX_API_KEY = env.BLUESIX_API_KEY;

async function bluesixRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (getApiV2BaseUrls().length === 0) {
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

  const { response } = await fetchApiV2WithFailover({
    pathname: normalizedEndpoint,
    retryNonIdempotent: false,
    init: {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BLUESIX_API_KEY,
        ...options.headers,
      },
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
