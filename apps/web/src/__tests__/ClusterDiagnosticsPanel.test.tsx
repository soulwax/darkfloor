// File: apps/web/src/__tests__/ClusterDiagnosticsPanel.test.tsx

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClusterDiagnosticsPanel } from "@/app/admin/ClusterDiagnosticsPanel";
import { type ApiClusterDiagnostics } from "@/app/admin/clusterDiagnostics";
import { describe, expect, it, vi } from "vitest";

const diagnostics: ApiClusterDiagnostics = {
  baseUrl: "https://ld.songbirdapi.com",
  timestamp: "2026-04-14T12:00:00.000Z",
  localVersion: "2.4.0",
  localUrl: "https://ld.songbirdapi.com",
  referenceUrl: "https://ld.songbirdapi.com",
  total: 2,
  healthyCount: 1,
  inSyncCount: 1,
  nodes: [
    {
      url: "https://down.songbirdapi.com",
      status: "error",
      version: null,
      httpStatus: 503,
      responseTimeMs: 900,
      nodeEnv: "production",
      isVercel: false,
      inSync: false,
      isSelf: false,
      fetchedAt: "2026-04-14T12:00:02.000Z",
      requestedUrl: "https://down.songbirdapi.com/api/v2/status",
      publicConfig: null,
      error: "upstream timeout",
      state: "unhealthy",
    },
    {
      url: "https://ok.songbirdapi.com",
      status: "ok",
      version: "2.4.0",
      httpStatus: 200,
      responseTimeMs: 120,
      nodeEnv: "production",
      isVercel: true,
      inSync: true,
      isSelf: true,
      fetchedAt: "2026-04-14T12:00:00.000Z",
      requestedUrl: "https://ok.songbirdapi.com/api/v2/status",
      publicConfig: {
        app: { name: "Songbird API", version: "2.4.0" },
        environment: { nodeVersion: "v22.15.0", isNetlify: false },
        urls: { appUrl: "https://ok.songbirdapi.com" },
        cors: {
          origins: ["https://darkfloor.org", "https://www.darkfloor.org"],
          note: "central hub",
        },
      },
      error: null,
      state: "healthy",
    },
  ],
};

describe("ClusterDiagnosticsPanel", () => {
  it("renders summary counts, unhealthy node details, and expandable public config data", () => {
    const onRefresh = vi.fn();

    render(
      <ClusterDiagnosticsPanel
        diagnostics={diagnostics}
        error="Detailed diagnostics fell back to summary-only auth handling."
        isLoading={false}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText(/total nodes/i)).toBeInTheDocument();
    expect(screen.getAllByText("2.4.0").length).toBeGreaterThan(0);
    expect(screen.getByText("https://down.songbirdapi.com")).toBeInTheDocument();
    expect(screen.getByText("upstream timeout")).toBeInTheDocument();
    expect(screen.getByText(/Public config details/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Songbird API/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/https:\/\/darkfloor\.org, https:\/\/www\.darkfloor\.org/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /refresh cluster diagnostics/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders a resilient empty state when diagnostics are unavailable", () => {
    render(
      <ClusterDiagnosticsPanel
        diagnostics={null}
        error={null}
        isLoading={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Cluster diagnostics are not available yet/i),
    ).toBeInTheDocument();
  });
});
