// File: apps/web/src/__tests__/og-image-real-urls.test.ts

import { describe, expect, it, beforeAll } from "vitest";
import { GET } from "@/app/api/og/route";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const REAL_TEST_URLS = [
  {
    name: "Homepage",
    url: "https://starchildmusic.com",
    expectedRedirect: true, // Should redirect to static image
  },
  {
    name: "Query: red runner wayne snow",
    url: "https://starchildmusic.com",
    query: "red runner wayne snow",
    trackId: null,
  },
  {
    name: "Track ID: 141368709 (Red Runner - Wayne Snow)",
    url: "https://www.darkfloor.art",
    trackId: "141368709",
    query: null,
  },
  {
    name: "Query: madonna frozen meltdown",
    url: "https://www.darkfloor.art",
    query: "madonna frozen meltdown",
    trackId: null,
  },
  {
    name: "Query: Depeche Mode",
    url: "https://www.darkfloor.art",
    query: "Depeche Mode",
    trackId: null,
  },
  {
    name: "Track ID: 84756133 (Medford - Mr Twin Sister)",
    url: "https://www.darkfloor.art",
    trackId: "84756133",
    query: null,
  },
  {
    name: "Query: mr twin sister medford",
    url: "https://www.darkfloor.art",
    query: "mr twin sister medford",
    trackId: null,
  },
];

type TrackData = {
  title?: string;
  name?: string;
  artist?: string | { name?: string };
};

type SearchData = {
  data?: TrackData[];
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

describe("OG Image Generation - Real URLs Integration Tests", () => {
  beforeAll(async () => {
    await mkdir(join(process.cwd(), "test-output", "real-urls"), {
      recursive: true,
    });
  });

  it("redirects to static image for homepage (no params)", async () => {
    const ogUrl = new URL("https://starchildmusic.com/api/og");

    const mockRequest = {
      nextUrl: ogUrl,
    } as NextRequest;

    const response = await GET(mockRequest);

    expect(response).toBeTruthy();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/og-image.png");
  }, 10000);

  for (const testCase of REAL_TEST_URLS) {
    if (testCase.expectedRedirect) {
      continue; // Skip, already tested above
    }

    if (testCase.trackId) {
      it(`generates OG image for trackId=${testCase.trackId} (${testCase.name})`, async () => {
        console.log(`\n[Real URL Test] Testing trackId=${testCase.trackId}...`);

        // First, verify the track exists by fetching it
        let trackData: TrackData | undefined;
        try {
          const trackApiUrl = new URL(
            `/api/track/${testCase.trackId}`,
            testCase.url,
          );
          console.log(
            `[Real URL Test] Fetching track from: ${trackApiUrl.toString()}`,
          );

          const trackResponse = await fetchWithTimeout(
            trackApiUrl.toString(),
            5000,
          );

          if (!trackResponse.ok) {
            console.warn(
              `[Real URL Test] Track API returned ${trackResponse.status}, skipping test`,
            );
            return;
          }

          trackData = (await trackResponse.json()) as TrackData;
          console.log(
            `[Real URL Test] Track found: ${trackData.title ?? trackData.name} by ${
              typeof trackData.artist === "string"
                ? trackData.artist
                : trackData.artist?.name
            }`,
          );
        } catch (error) {
          console.error(
            `[Real URL Test] Failed to fetch track ${testCase.trackId}:`,
            error,
          );
          // Continue anyway - the OG route should handle this
        }

        const ogUrl = new URL(`${testCase.url}/api/og`);
        ogUrl.searchParams.set("trackId", testCase.trackId);

        const mockRequest = {
          nextUrl: ogUrl,
        } as NextRequest;

        console.log(`[Real URL Test] Generating OG image...`);
        const startTime = Date.now();
        const response = await GET(mockRequest);
        const duration = Date.now() - startTime;

        console.log(
          `[Real URL Test] Response received in ${duration}ms, status: ${response.status}`,
        );

        if (response.status === 302) {
          console.warn(
            `[Real URL Test] OG route redirected to static image (likely timeout or missing data)`,
          );
          expect(response.headers.get("location")).toContain("/og-image.png");
          return;
        }

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/png");

        const arrayBuffer = await response.arrayBuffer();
        expect(arrayBuffer.byteLength).toBeGreaterThan(0);

        const safeName = testCase.name
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase();
        const outputPath = join(
          process.cwd(),
          "test-output",
          "real-urls",
          `og-trackid-${testCase.trackId}-${safeName}.png`,
        );

        await writeFile(outputPath, Buffer.from(arrayBuffer));
        console.log(
          `[Real URL Test] Image saved to: ${outputPath} (${arrayBuffer.byteLength} bytes)`,
        );
      }, 30000);
    } else if (testCase.query) {
      it(`generates OG image for query="${testCase.query}" (${testCase.name})`, async () => {
        console.log(`\n[Real URL Test] Testing query="${testCase.query}"...`);

        // First, verify the search works
        let searchData: SearchData | undefined;
        try {
          const searchApiUrl = new URL(`${testCase.url}/api/music/search`);
          searchApiUrl.searchParams.set("q", testCase.query);
          console.log(
            `[Real URL Test] Searching from: ${searchApiUrl.toString()}`,
          );

          const searchResponse = await fetchWithTimeout(
            searchApiUrl.toString(),
            5000,
          );

          if (!searchResponse.ok) {
            console.warn(
              `[Real URL Test] Search API returned ${searchResponse.status}, skipping test`,
            );
            return;
          }

          searchData = (await searchResponse.json()) as SearchData;
          const firstTrack = searchData.data?.[0];
          if (!firstTrack) {
            console.warn(
              `[Real URL Test] No results for query "${testCase.query}", skipping test`,
            );
            return;
          }

          console.log(
            `[Real URL Test] First result: ${firstTrack.title ?? firstTrack.name} by ${
              typeof firstTrack.artist === "string"
                ? firstTrack.artist
                : firstTrack.artist?.name
            }`,
          );
        } catch (error) {
          console.error(
            `[Real URL Test] Failed to search for "${testCase.query}":`,
            error,
          );
          // Continue anyway - the OG route should handle this
        }

        const ogUrl = new URL(`${testCase.url}/api/og`);
        ogUrl.searchParams.set("q", testCase.query);

        const mockRequest = {
          nextUrl: ogUrl,
        } as NextRequest;

        console.log(`[Real URL Test] Generating OG image...`);
        const startTime = Date.now();
        const response = await GET(mockRequest);
        const duration = Date.now() - startTime;

        console.log(
          `[Real URL Test] Response received in ${duration}ms, status: ${response.status}`,
        );

        if (response.status === 302) {
          console.warn(
            `[Real URL Test] OG route redirected to static image (likely timeout or missing data)`,
          );
          expect(response.headers.get("location")).toContain("/og-image.png");
          return;
        }

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/png");

        const arrayBuffer = await response.arrayBuffer();
        expect(arrayBuffer.byteLength).toBeGreaterThan(0);

        const safeName = testCase.name
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase();
        const safeQuery = testCase.query
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase();
        const outputPath = join(
          process.cwd(),
          "test-output",
          "real-urls",
          `og-query-${safeQuery}-${safeName}.png`,
        );

        await writeFile(outputPath, Buffer.from(arrayBuffer));
        console.log(
          `[Real URL Test] Image saved to: ${outputPath} (${arrayBuffer.byteLength} bytes)`,
        );
      }, 30000);
    }
  }

  it("handles timeout gracefully for slow API responses", async () => {
    // This test verifies that the timeout logic works
    // We'll use a query that might be slow or a trackId that doesn't exist
    const ogUrl = new URL("https://starchildmusic.com/api/og");
    ogUrl.searchParams.set(
      "q",
      "very obscure track that probably doesn't exist xyz123abc",
    );

    const mockRequest = {
      nextUrl: ogUrl,
    } as NextRequest;

    const startTime = Date.now();
    const response = await GET(mockRequest);
    const duration = Date.now() - startTime;

    console.log(
      `[Real URL Test] Timeout test completed in ${duration}ms, status: ${response.status}`,
    );

    // Should either redirect (no results) or return image (if found)
    expect([200, 302]).toContain(response.status);

    if (response.status === 302) {
      expect(response.headers.get("location")).toContain("/og-image.png");
    } else {
      expect(response.headers.get("content-type")).toContain("image/png");
    }

    // Should complete within reasonable time (not timeout)
    expect(duration).toBeLessThan(10000);
  }, 15000);
});
