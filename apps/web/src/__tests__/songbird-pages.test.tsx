// File: apps/web/src/__tests__/songbird-pages.test.tsx

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function toRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("songbird pages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders auth-me page data from internal route only", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = toRequestUrl(input);
      if (url === "/api/songbird/auth-me") {
        return new Response(JSON.stringify({ userId: "user-123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected URL requested: ${url}`);
    });

    const AuthMePage = (await import("@/app/songbird/auth-me/page")).default;
    render(<AuthMePage />);

    await waitFor(() => {
      expect(screen.getByText(/user-123/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
    const requestedUrls = fetchMock.mock.calls.map(([input]) => toRequestUrl(input));
    expect(requestedUrls).toEqual(["/api/songbird/auth-me"]);
  });

  it("renders cache-stats page data from internal route only", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = toRequestUrl(input);
      if (url === "/api/songbird/cache-stats") {
        return new Response(JSON.stringify({ totalKeys: 42 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected URL requested: ${url}`);
    });

    const CacheStatsPage = (await import("@/app/songbird/cache-stats/page"))
      .default;
    render(<CacheStatsPage />);

    await waitFor(() => {
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
    const requestedUrls = fetchMock.mock.calls.map(([input]) => toRequestUrl(input));
    expect(requestedUrls).toEqual(["/api/songbird/cache-stats"]);
  });
});
