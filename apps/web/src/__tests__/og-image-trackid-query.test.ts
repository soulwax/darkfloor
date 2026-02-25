// File: apps/web/src/__tests__/og-image-trackid-query.test.ts

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/og/route";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const TEST_TRACKS = [
  {
    id: 16620382,
    searchQuery: "film burn yppah",
    expectedTitle: "Film Burn",
    expectedArtist: "Yppah",
  },
  {
    id: 1913577097,
    searchQuery: "apocalyptica path",
    expectedTitle: "Path",
    expectedArtist: "Apocalyptica",
  },
];

// Mock fetch for testing
const originalFetch = global.fetch;

describe("OG Image Generation - Track ID & Query Support", () => {
  beforeEach(async () => {
    await mkdir(join(process.cwd(), "test-output"), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Track ID Parameter", () => {
    for (const testTrack of TEST_TRACKS) {
      it(`generates OG image from trackId=${testTrack.id}`, async () => {
        const mockTrackResponse = {
          title: testTrack.expectedTitle,
          artist: { name: testTrack.expectedArtist },
          album: {
            title: "Test Album",
            cover_big: "https://example.com/cover.jpg",
            cover_medium: "https://example.com/cover-medium.jpg",
          },
          duration: 240,
        };

        // Create a minimal valid PNG (1x1 pixel transparent)
        const pngHeader = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
          0xae, 0x42, 0x60, 0x82,
        ]);
        const mockCoverResponse = new Response(pngHeader, {
          headers: { "content-type": "image/png", "content-length": String(pngHeader.length) },
        });

        global.fetch = vi.fn().mockImplementation((url: string | URL) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const urlObj = typeof url === "string" ? new URL(url) : url;

          // Handle emoji/icon CDN
          if (urlStr.includes("cdn.jsdelivr.net") || urlStr.includes("twemoji")) {
            return Promise.resolve(
              new Response("<svg></svg>", {
                status: 200,
                headers: { "Content-Type": "image/svg+xml" },
              })
            );
          }

          // Handle fonts
          if (urlStr.includes(".woff") || urlStr.includes(".woff2") || urlStr.includes(".ttf") || urlStr.includes("fonts")) {
            return Promise.resolve(
              new Response(new ArrayBuffer(0), {
                status: 200,
                headers: { "Content-Type": "font/woff2" },
              })
            );
          }

          // Handle track API calls - match by pathname
          if (urlObj.pathname === `/api/track/${testTrack.id}` || urlStr.includes(`/api/track/${testTrack.id}`)) {
            return Promise.resolve(
              new Response(JSON.stringify(mockTrackResponse), {
                headers: { "content-type": "application/json" },
              }),
            );
          }
          // Handle search API calls - match by pathname and query param
          if (urlObj.pathname === "/api/music/search") {
            const query = urlObj.searchParams.get("q");
            if (query === testTrack.searchQuery) {
              return Promise.resolve(
                new Response(JSON.stringify({ data: [mockTrackResponse] }), {
                  headers: { "content-type": "application/json" },
                }),
              );
            }
          }
          // Handle cover image URLs
          if (urlStr.includes("cover") || urlStr.includes("example.com")) {
            return Promise.resolve(mockCoverResponse);
          }
          // Reject for any other URLs to avoid real network calls
          return Promise.reject(new Error(`Unexpected fetch to: ${urlStr}`));
        });

        // Use localhost origin to avoid connection issues in tests
        const ogUrl = new URL("http://localhost:3000/api/og");
        ogUrl.searchParams.set("trackId", testTrack.id.toString());

        const mockRequest = {
          nextUrl: ogUrl,
        } as NextRequest;

        const response = await GET(mockRequest);

        expect(response).toBeTruthy();
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/png");

        const arrayBuffer = await response.arrayBuffer();
        expect(arrayBuffer.byteLength).toBeGreaterThan(0);

        const outputPath = join(
          process.cwd(),
          "test-output",
          `og-trackid-${testTrack.id}.png`,
        );
        await writeFile(outputPath, Buffer.from(arrayBuffer));
        console.log(`[Test] Track ID image saved to: ${outputPath}`);
      }, 30000);
    }

    it("falls back to static image when trackId fetch fails", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error("Network error"));
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "999999999");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      // Should redirect to static image when fetch fails
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);

    it("falls back to static image when trackId returns 404", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve(
          new Response("Not Found", { status: 404 }),
        );
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "999999999");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);
  });

  describe("Query String Parameter", () => {
    for (const testTrack of TEST_TRACKS) {
      it(`generates OG image from query="${testTrack.searchQuery}"`, async () => {
        const mockSearchResponse = {
          data: [
            {
              title: testTrack.expectedTitle,
              artist: { name: testTrack.expectedArtist },
              album: {
                title: "Test Album",
                cover_big: "https://example.com/cover.jpg",
                cover_medium: "https://example.com/cover-medium.jpg",
              },
              duration: 240,
            },
          ],
        };

        // Create a minimal valid PNG
        const pngHeader = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
          0xae, 0x42, 0x60, 0x82,
        ]);
        const mockCoverResponse = new Response(pngHeader, {
          headers: { "content-type": "image/png", "content-length": String(pngHeader.length) },
        });

        global.fetch = vi.fn().mockImplementation((url: string | URL) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const urlObj = typeof url === "string" ? new URL(url) : url;
          
          // Handle search API calls - match by pathname and query param
          if (urlObj.pathname === "/api/music/search") {
            const query = urlObj.searchParams.get("q");
            if (query === testTrack.searchQuery) {
              return Promise.resolve(
                new Response(JSON.stringify(mockSearchResponse), {
                  headers: { "content-type": "application/json" },
                }),
              );
            }
          }
          // Handle cover image URLs
          if (urlStr.includes("cover") || urlStr.includes("example.com")) {
            return Promise.resolve(mockCoverResponse);
          }
          // Reject for any other URLs to avoid real network calls
          return Promise.reject(new Error(`Unexpected fetch to: ${urlStr}`));
        });

        // Use localhost origin to avoid connection issues in tests
        const ogUrl = new URL("http://localhost:3000/api/og");
        ogUrl.searchParams.set("q", testTrack.searchQuery);

        const mockRequest = {
          nextUrl: ogUrl,
        } as NextRequest;

        const response = await GET(mockRequest);

        expect(response).toBeTruthy();
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/png");

        const arrayBuffer = await response.arrayBuffer();
        expect(arrayBuffer.byteLength).toBeGreaterThan(0);

        const outputPath = join(
          process.cwd(),
          "test-output",
          `og-query-${testTrack.searchQuery.replace(/[^a-z0-9]/gi, "-")}.png`,
        );
        await writeFile(outputPath, Buffer.from(arrayBuffer));
        console.log(`[Test] Query image saved to: ${outputPath}`);
      }, 30000);
    }

    it("falls back to static image when query returns no results", async () => {
      const mockSearchResponse = {
        data: [],
      };

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/music/search")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockSearchResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("q", "nonexistent track xyz123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);

    it("falls back to static image when search fails", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error("Search failed"));
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("q", "test query");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);
  });

  describe("Fallback to Direct Parameters", () => {
    it("uses direct parameters when trackId and query are not provided", async () => {
      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("title", "Test Track");
      ogUrl.searchParams.set("artist", "Test Artist");
      ogUrl.searchParams.set("album", "Test Album");
      ogUrl.searchParams.set("duration", "240");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response).toBeTruthy();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");

      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);

      const outputPath = join(
        process.cwd(),
        "test-output",
        "og-direct-params.png",
      );
      await writeFile(outputPath, Buffer.from(arrayBuffer));
      console.log(`[Test] Direct params image saved to: ${outputPath}`);
    }, 30000);

    it("falls back to direct parameters when trackId fetch fails but params are provided", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error("Network error"));
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "999999999");
      ogUrl.searchParams.set("title", "Fallback Track");
      ogUrl.searchParams.set("artist", "Fallback Artist");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      // Should use fallback direct parameters
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);
  });

  describe("Timeout Handling", () => {
    it("redirects to static image when trackId fetch times out", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ title: "Test" }), {
                headers: { "content-type": "application/json" },
              }),
            );
          }, 3000); // Longer than 2s timeout
        });
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      // Should redirect due to timeout
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);

    it("redirects to static image when query search times out", async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ data: [] }), {
                headers: { "content-type": "application/json" },
              }),
            );
          }, 3000); // Longer than 2s timeout
        });
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("q", "test query");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/og-image.png");
    }, 10000);
  });

  describe("Cover Image Handling", () => {
    it("skips cover image when it's too large", async () => {
      const mockTrackResponse = {
        title: "Test Track",
        artist: { name: "Test Artist" },
        album: {
          title: "Test Album",
          cover_big: "https://example.com/large-cover.jpg",
        },
        duration: 240,
      };

      const largeCoverResponse = new Response(
        new Uint8Array(600_000).fill(0), // 600KB > 500KB limit
        {
          headers: {
            "content-type": "image/jpeg",
            "content-length": "600000",
          },
        },
      );

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/track/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockTrackResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        if (urlStr.includes("cover")) {
          return Promise.resolve(largeCoverResponse);
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      // Should still generate image without cover
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);

    it("skips cover image when fetch times out", async () => {
      const mockTrackResponse = {
        title: "Test Track",
        artist: { name: "Test Artist" },
        album: {
          title: "Test Album",
          cover_big: "https://example.com/slow-cover.jpg",
        },
        duration: 240,
      };

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/track/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockTrackResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        if (urlStr.includes("cover")) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
                  headers: { "content-type": "image/jpeg" },
                }),
              );
            }, 2000); // Longer than 1s timeout
          });
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      // Should still generate image without cover
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);
  });

  describe("Data Format Handling", () => {
    it("handles track with artist as string", async () => {
      const mockTrackResponse = {
        title: "Test Track",
        artist: "Test Artist", // String instead of object
        duration: 240,
      };

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/track/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockTrackResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);

    it("handles track with name instead of title", async () => {
      const mockTrackResponse = {
        name: "Test Track", // name instead of title
        artist: { name: "Test Artist" },
        duration: 240,
      };

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/track/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockTrackResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);

    it("handles track with cover_xl in album", async () => {
      const mockTrackResponse = {
        title: "Test Track",
        artist: { name: "Test Artist" },
        album: {
          title: "Test Album",
          cover_xl: "https://example.com/cover-xl.jpg", // cover_xl instead of cover_big
        },
        duration: 240,
      };

      // Create a minimal valid PNG (1x1 pixel transparent)
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
        0xae, 0x42, 0x60, 0x82,
      ]);
      const mockCoverResponse = new Response(pngHeader, {
        headers: { "content-type": "image/png", "content-length": String(pngHeader.length) },
      });

      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/track/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockTrackResponse), {
              headers: { "content-type": "application/json" },
            }),
          );
        }
        if (urlStr.includes("cover")) {
          return Promise.resolve(mockCoverResponse);
        }
        return originalFetch(url);
      });

      const ogUrl = new URL("http://localhost:3000/api/og");
      ogUrl.searchParams.set("trackId", "123");

      const mockRequest = {
        nextUrl: ogUrl,
      } as NextRequest;

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
    }, 10000);
  });
});
