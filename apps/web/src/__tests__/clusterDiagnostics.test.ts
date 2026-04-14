// File: apps/web/src/__tests__/clusterDiagnostics.test.ts

import {
  getClusterNodeState,
  normalizeClusterDiagnostics,
  sortClusterNodes,
  type ApiClusterNodeDiagnostics,
} from "@/app/admin/clusterDiagnostics";
import { describe, expect, it } from "vitest";

describe("cluster diagnostics helpers", () => {
  it("normalizes partial payloads and sorts unhealthy nodes first", () => {
    const diagnostics = normalizeClusterDiagnostics(
      {
        localVersion: "2.4.0",
        nodes: [
          {
            url: "https://healthy.songbirdapi.com",
            status: "ok",
            httpStatus: 200,
            responseTimeMs: 50,
            inSync: true,
          },
          {
            url: "https://drift.songbirdapi.com",
            status: "ok",
            httpStatus: 200,
            responseTimeMs: 25,
            inSync: false,
          },
          {
            requestedUrl: "https://down.songbirdapi.com/api/v2/status",
            status: "error",
            httpStatus: 503,
            error: "timeout",
          },
        ],
      },
      "https://ld.songbirdapi.com",
    );

    expect(diagnostics.baseUrl).toBe("https://ld.songbirdapi.com");
    expect(diagnostics.total).toBe(3);
    expect(diagnostics.healthyCount).toBe(1);
    expect(diagnostics.inSyncCount).toBe(1);
    expect(diagnostics.nodes.map((node) => node.url)).toEqual([
      "https://down.songbirdapi.com/api/v2/status",
      "https://drift.songbirdapi.com",
      "https://healthy.songbirdapi.com",
    ]);
    expect(diagnostics.nodes[0]?.error).toBe("timeout");
  });

  it("derives node states and keeps self nodes ahead within the same rank", () => {
    const healthySelf: ApiClusterNodeDiagnostics = {
      url: "https://self.songbirdapi.com",
      status: "ok",
      version: "2.4.0",
      httpStatus: 200,
      responseTimeMs: 140,
      nodeEnv: "production",
      isVercel: false,
      inSync: true,
      isSelf: true,
      fetchedAt: null,
      requestedUrl: null,
      publicConfig: null,
      error: null,
      state: "healthy",
    };
    const healthyPeer: ApiClusterNodeDiagnostics = {
      ...healthySelf,
      url: "https://peer.songbirdapi.com",
      isSelf: false,
      responseTimeMs: 40,
    };

    expect(getClusterNodeState(healthyPeer)).toBe("healthy");
    expect(
      getClusterNodeState({
        ...healthyPeer,
        status: "error",
        error: "boom",
      }),
    ).toBe("unhealthy");
    expect(
      getClusterNodeState({
        ...healthyPeer,
        inSync: false,
      }),
    ).toBe("out-of-sync");

    expect(sortClusterNodes([healthyPeer, healthySelf]).map((node) => node.url)).toEqual([
      "https://self.songbirdapi.com",
      "https://peer.songbirdapi.com",
    ]);
  });
});
