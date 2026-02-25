// File: apps/web/src/app/api/health/route.ts

import { type NextRequest, NextResponse } from "next/server";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};

  let isAllowed = false;
  try {
    const url = new URL(origin);
    if (LOCALHOST_HOSTNAMES.has(url.hostname)) {
      isAllowed = true;
    }
  } catch {
    isAllowed = false;
  }

  if (!isAllowed && origin === request.nextUrl.origin) {
    isAllowed = true;
  }

  if (!isAllowed) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  const corsHeaders = getCorsHeaders(request);

  const send = (body: object, status: number) => {
    const res = NextResponse.json(body, { status });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (value !== undefined) res.headers.set(key, value);
    });
    return res;
  };

  try {
  if (isDev) {
    const origin = request.headers.get("origin");
    const userAgent = request.headers.get("user-agent");
    const referer = request.headers.get("referer");
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const forwardedIp = forwardedFor?.split(",")[0]?.trim();
    const ip = forwardedIp ?? realIp ?? "unknown";

    console.log("[Health Check] Request received:", {
      method: request.method,
      url: request.url,
      origin,
      userAgent,
      referer,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    checks: {
      database: "unknown" as "ok" | "error" | "unknown" | "skipped",
    },
  };

  try {
    const { pool } = await import("@/server/db");
    await pool.query("SELECT 1");
    health.checks.database = "ok";
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("DATABASE_URL") ||
        error.message.includes("required"))
    ) {
      health.checks.database = "skipped";
    } else {
      health.checks.database = "error";
      health.status = "error";
    }
    const responseTime = Date.now() - startTime;

    if (isDev && health.checks.database === "error") {
      console.error("[Health Check] Database check failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime: `${responseTime}ms`,
      });
    }

    if (health.checks.database === "error") {
      return send(
        {
          ...health,
          error:
            error instanceof Error ? error.message : "Unknown database error",
          responseTime,
        },
        503
      );
    }
  }

  const responseTime = Date.now() - startTime;

  if (isDev) {
    console.log("[Health Check] Response sent:", {
      status: "ok",
      responseTime: `${responseTime}ms`,
      database: health.checks.database,
      memory: health.memory,
    });
  }

  return send({ ...health, responseTime }, 200);
  } catch (outerError) {
    return send(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error:
          outerError instanceof Error
            ? outerError.message
            : "Health check failed",
      },
      503
    );
  }
}
