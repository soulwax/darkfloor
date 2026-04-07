// File: apps/web/src/app/api/stream/route.ts

import { env } from "@/env";
import {
  fetchApiV2WithFailover,
  getApiV2BaseUrls,
} from "@/lib/server/api-v2-upstream";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_GUEST_STREAM_KBPS = "128";
const VERCEL_ENV_KEYS = ["VERCEL", "VERCEL_ENV", "VERCEL_URL"] as const;

function getConfiguredApiV2Label(): string {
  const baseUrls = getApiV2BaseUrls("stream");
  return baseUrls.length > 0 ? baseUrls.join(", ") : "API_V2_URL not configured";
}

function redactKeyFromUrl(rawUrl: string): string {
  try {
    const safeUrl = new URL(rawUrl);
    if (safeUrl.searchParams.has("key")) {
      safeUrl.searchParams.set("key", "***");
    }
    return safeUrl.toString();
  } catch {
    return rawUrl;
  }
}

function isSupportedAudioContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith("audio/") ||
    normalized.includes("application/octet-stream")
  );
}

function isRunningOnVercel(): boolean {
  return VERCEL_ENV_KEYS.some((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q");
  const id = searchParams.get("id");
  const format = searchParams.get("format")?.trim().toLowerCase();

  if (!query && !id) {
    return NextResponse.json(
      { error: "Missing query or id parameter" },
      { status: 400 },
    );
  }

  try {
    const bluesixApiKey = env.BLUESIX_API_KEY?.trim();
    const missingEnvVars: string[] = [];

    if (getApiV2BaseUrls("stream").length === 0) {
      missingEnvVars.push("API_V2_URL");
    }
    if (!bluesixApiKey) {
      missingEnvVars.push("BLUESIX_API_KEY");
    }

    if (missingEnvVars.length > 0) {
      const message = `Missing required stream configuration: ${missingEnvVars.join(", ")}`;
      console.error(`[Stream API] ${message}`);
      return NextResponse.json(
        {
          error: message,
          missing: missingEnvVars,
        },
        { status: 500 },
      );
    }

    const configuredBluesixApiKey = bluesixApiKey!;

    const rangeHeader = req.headers.get("range");
    const effectiveRange = rangeHeader ?? "bytes=0-";
    const fetchHeaders: HeadersInit = { Range: effectiveRange };

    console.log("[Stream API] Request headers:", {
      Range: effectiveRange,
      "User-Agent": req.headers.get("User-Agent") ?? "unknown",
    });

    const buildStreamResponse = (response: Response) => {
      const contentType = response.headers.get("content-type") ?? "audio/mpeg";
      const contentLength = response.headers.get("content-length");
      const acceptRanges = response.headers.get("accept-ranges");
      const contentRange = response.headers.get("content-range");

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      };

      if (contentLength) headers["Content-Length"] = contentLength;
      if (acceptRanges) headers["Accept-Ranges"] = acceptRanges;
      if (contentRange) headers["Content-Range"] = contentRange;

      return new NextResponse(response.body, {
        status: response.status,
        headers,
      });
    };

    const useDirectStreamRoute = format === "flac" || isRunningOnVercel();
    const upstreamPath = useDirectStreamRoute
      ? "music/stream/direct"
      : "music/stream";
    const url = new URL(upstreamPath, "http://api-v2.local");
    url.searchParams.set("key", configuredBluesixApiKey);
    if (format === "flac") {
      url.searchParams.set("format", "flac");
    } else {
      url.searchParams.set(
        "kbps",
        req.nextUrl.searchParams.get("kbps") ?? DEFAULT_GUEST_STREAM_KBPS,
      );
    }

    if (id) {
      url.searchParams.set("id", id);
      console.log("[Stream API] V2 streaming by ID:", id);
    } else if (query) {
      url.searchParams.set("q", query);
      console.log("[Stream API] V2 streaming by query:", query);
    }

    const requestUrl = url.toString();
    const redactedRequestUrl = redactKeyFromUrl(requestUrl);
    console.log(
      "[Stream API] Fetching stream from:",
      redactedRequestUrl,
    );
    console.log("[Stream API] Selected upstream route:", `/${upstreamPath}`);
    console.log(
      "[Stream API] Full URL (key hidden):",
      redactedRequestUrl,
    );

    let response: Response;
    let resolvedUpstreamUrl = redactedRequestUrl;
    let resolvedBackendBaseUrl = getConfiguredApiV2Label();
    try {
      const upstreamResult = await fetchApiV2WithFailover({
        pathname: `${url.pathname}${url.search}`,
        pool: "stream",
        timeoutMs: 30000,
        init: {
          headers: fetchHeaders,
        },
      });
      response = upstreamResult.response;
      resolvedUpstreamUrl = redactKeyFromUrl(upstreamResult.upstreamUrl);
      resolvedBackendBaseUrl = upstreamResult.baseUrl;
      console.info(
        `[Stream API] Using API_V2_URL host: ${new URL(upstreamResult.upstreamUrl).host}`,
      );
    } catch (fetchError) {
      console.error("[Stream API] Fetch failed:", fetchError);
      if (fetchError instanceof Error) {
        if (
          fetchError.name === "AbortError" ||
          fetchError.message.includes("timeout")
        ) {
          console.error(
            "[Stream API] Request timed out - backend may be unresponsive",
          );
          return NextResponse.json(
            {
              error: "Backend request timed out",
              message:
                "The backend server did not respond in time. Check if the backend is running and accessible.",
              type: "timeout",
              backendUrl: getConfiguredApiV2Label(),
            },
            { status: 504 },
          );
        }

        if (
          fetchError.message.includes("ECONNREFUSED") ||
          fetchError.message.includes("ENOTFOUND") ||
          fetchError.message.includes("getaddrinfo")
        ) {
          console.error(
            "[Stream API] Connection refused - backend may not be running or URL is incorrect",
          );
          return NextResponse.json(
            {
              error: "Cannot connect to backend",
              message:
                "Failed to connect to any configured backend. Check if the backend nodes are running and API_V2_URL/API_V2_URLS are correct.",
              type: "connection_error",
              backendUrl: getConfiguredApiV2Label(),
            },
            { status: 502 },
          );
        }
      }
      throw fetchError;
    }

    if (!response.ok) {
      const statusCode = response.status;
      const statusText = response.statusText;

      let errorText = "";
      let errorData: { message?: string; error?: string } = {};

      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText) as {
            message?: string;
            error?: string;
          };
        } catch {
          errorData = { message: errorText };
        }
      } catch (readError) {
        console.error("[Stream API] Could not read error response:", readError);
        errorText = "Could not read error response";
        errorData = { message: errorText };
      }

      console.error(
        `[Stream API] Stream failed: ${statusCode} ${statusText}`,
      );
      console.error("[Stream API] Error details:", errorData);
      console.error(
        "[Stream API] Response headers:",
        Object.fromEntries(response.headers.entries()),
      );
      console.error("[Stream API] Request URL:", resolvedUpstreamUrl);

      const isUpstreamError =
        statusCode === 502 ||
        statusCode === 503 ||
        statusCode === 504 ||
        (errorData.message?.includes("upstream error") ?? false) ||
        (errorData.message?.includes("Bad Gateway") ?? false) ||
        (errorData.message?.includes("Service Unavailable") ?? false) ||
        errorData.error === "ServiceUnavailableException";

      const errorMessage =
        statusCode === 502
          ? "Backend returned 502 Bad Gateway - upstream service may be down or unreachable"
          : isUpstreamError
            ? "Upstream service unavailable"
            : `Stream failed: ${statusText}`;

      return NextResponse.json(
        {
          error: errorMessage,
          message: errorData.message ?? errorText,
          details: errorData,
          status: statusCode,
          backendUrl: resolvedUpstreamUrl,
          type: isUpstreamError ? "upstream_error" : "stream_error",
          diagnostics: {
            trackId: id ?? null,
            query: query ?? null,
            backendBaseUrl: resolvedBackendBaseUrl,
            hasApiKey: !!configuredBluesixApiKey,
          },
        },
        { status: statusCode },
      );
    }

    const upstreamContentType = response.headers.get("content-type");
    if (!isSupportedAudioContentType(upstreamContentType)) {
      let payloadPreview = "";
      try {
        payloadPreview = (await response.text()).slice(0, 400);
      } catch {
        payloadPreview = "Unable to read upstream payload";
      }

      console.error("[Stream API] Non-audio upstream payload received", {
        status: response.status,
        contentType: upstreamContentType,
        requestUrl: redactedRequestUrl,
        payloadPreview,
      });

      return NextResponse.json(
        {
          error: "Upstream returned non-audio payload",
          message:
            "The upstream stream endpoint responded with a non-audio content type.",
          type: "invalid_upstream_payload",
          status: 502,
          contentType: upstreamContentType,
          backendUrl: resolvedUpstreamUrl,
        },
        { status: 502 },
      );
    }

    return buildStreamResponse(response);
  } catch (error) {
    console.error("[Stream API] Streaming error:", error);
    console.error("[Stream API] Error stack:", error instanceof Error ? error.stack : "No stack trace");

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        console.error(
          "[Stream API] Request timed out - backend may be unresponsive",
        );
        return NextResponse.json(
          {
            error: "Backend request timed out",
            message:
              "The backend server did not respond in time. Check if the backend is running and accessible.",
            type: "timeout",
            backendUrl: getConfiguredApiV2Label(),
          },
          { status: 504 },
        );
      }

      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("getaddrinfo")
      ) {
        console.error(
          "[Stream API] Connection refused - backend may not be running or URL is incorrect",
        );
        return NextResponse.json(
          {
            error: "Cannot connect to backend",
            message:
              "Failed to connect to any configured backend. Check if the backend nodes are running and API_V2_URL/API_V2_URLS are correct.",
            type: "connection_error",
            backendUrl: getConfiguredApiV2Label(),
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch stream",
        message: error instanceof Error ? error.message : "Unknown error",
        type: "unknown_error",
        backendUrl: getConfiguredApiV2Label(),
      },
      { status: 500 },
    );
  }
}
