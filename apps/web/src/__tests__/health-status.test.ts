// File: apps/web/src/__tests__/health-status.test.ts

import { describe, expect, it } from "vitest";
import { normalizeHealthStatus } from "@/utils/healthStatus";

describe("normalizeHealthStatus", () => {
  it("accepts JSON status values", () => {
    expect(normalizeHealthStatus({ status: "ok" })).toBe("ok");
    expect(normalizeHealthStatus({ status: "healthy" })).toBe("ok");
    expect(normalizeHealthStatus({ status: "up" })).toBe("ok");
    expect(normalizeHealthStatus({ status: "degraded" })).toBe("degraded");
    expect(normalizeHealthStatus({ status: "unhealthy" })).toBe("unhealthy");
    expect(normalizeHealthStatus({ status: "error" })).toBe("unhealthy");
  });

  it("accepts JSON ok booleans", () => {
    expect(normalizeHealthStatus({ ok: true })).toBe("ok");
    expect(normalizeHealthStatus({ ok: false })).toBe("unhealthy");
  });

  it("accepts plain text responses", () => {
    expect(normalizeHealthStatus(null, "ok")).toBe("ok");
    expect(normalizeHealthStatus(null, "OK\n")).toBe("ok");
    expect(normalizeHealthStatus(null, "degraded")).toBe("degraded");
    expect(normalizeHealthStatus(null, "unhealthy")).toBe("unhealthy");
    expect(normalizeHealthStatus(null, "error")).toBe("unhealthy");
  });

  it("returns null for unknown payloads", () => {
    expect(normalizeHealthStatus({ status: "unknown" })).toBeNull();
    expect(normalizeHealthStatus(null, "wat")).toBeNull();
  });
});
