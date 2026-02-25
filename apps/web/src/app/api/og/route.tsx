// File: apps/web/src/app/api/og/route.tsx

import { env } from "@/env";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const trackId = searchParams.get("trackId");
  const query = searchParams.get("q");
  const bluesixApiUrl = env.API_V2_URL;

  if (trackId) {
    if (bluesixApiUrl) {
      const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
      const previewUrl = `${normalizedBluesixUrl}/api/track/${encodeURIComponent(
        trackId,
      )}/preview`;
      console.log("[OG Route] Redirecting to V2 track preview:", previewUrl);
      return Response.redirect(previewUrl, 302);
    }

    console.log("[OG Route] V2 not configured for track preview");
  } else if (query) {
    const trimmedQuery = query.trim();
    
    // Strategy: First try to find the track via frontend search API
    // This is more reliable than relying on backend's query search
    // If we find a track, use trackId-based preview (most reliable)
    try {
      console.log("[OG Route] Searching for track via frontend API:", trimmedQuery);
      const searchUrl = new URL("/api/music/search", origin);
      searchUrl.searchParams.set("q", trimmedQuery);
      
      const searchResponse = await fetch(searchUrl.toString(), {
        signal: AbortSignal.timeout(10000),
      });

      if (searchResponse.ok) {
        const searchData = (await searchResponse.json()) as {
          data?: Array<{
            id?: number;
            title?: string;
            artist?: { name?: string } | string;
            album?: { title?: string } | null;
          }>;
        };

        const firstTrack = searchData.data?.[0];
        if (firstTrack?.id) {
          // Found a track! Use trackId-based preview (most reliable)
          console.log("[OG Route] Found track via search, using trackId:", firstTrack.id);
          
          if (bluesixApiUrl) {
            const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
            const previewUrl = `${normalizedBluesixUrl}/api/track/${encodeURIComponent(
              String(firstTrack.id),
            )}/preview`;
            console.log("[OG Route] Redirecting to V2 track preview:", previewUrl);
            return Response.redirect(previewUrl, 302);
          }
        }
      }
    } catch (error) {
      console.error("[OG Route] Frontend search failed:", error);
    }

    // Fallback: Use backend's query-based preview endpoint
    // This is less reliable but works when frontend search doesn't find a match
    const backendApiUrl = env.API_V2_URL;
    if (backendApiUrl) {
      const normalizedUrl = backendApiUrl.replace(/\/+$/, "");
      const encodedQuery = encodeURIComponent(trimmedQuery);
      const previewUrl = `${normalizedUrl}/api/preview?q=${encodedQuery}`;
      
      try {
        // CRITICAL: Always encode the query parameter using encodeURIComponent()
        // This converts spaces to %20, special characters like ö to %C3%B6, etc.
        // Example: "isobel björk" -> "isobel%20bj%C3%B6rk"
        // Using + signs or unencoded special characters will result in 0-byte responses
        
        console.log("[OG Route] Fallback: Using backend query-based preview:", {
          query: trimmedQuery,
          encoded: encodedQuery,
          previewUrl,
        });
        
        const response = await fetch(previewUrl, {
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          
          // Return the image (backend handles default vs track-specific internally)
          // Note: We can't distinguish between default and track-specific images
          // as both are valid PNG files. The backend returns default when track isn't found.
          return new Response(imageBuffer, {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } else {
          console.warn("[OG Route] Backend returned error:", {
            status: response.status,
            statusText: response.statusText,
          });
        }
      } catch (error) {
        console.error("[OG Route] Backend preview API error:", {
          error: error instanceof Error ? error.message : String(error),
          previewUrl,
        });
      }
    } else {
      console.warn("[OG Route] API_V2_URL not configured");
    }
  }

  console.log("[OG Route] No track data found, using default image");
  if (bluesixApiUrl) {
    const normalizedBluesixUrl = bluesixApiUrl.replace(/\/+$/, "");
    return Response.redirect(`${normalizedBluesixUrl}/api/preview/default`, 302);
  }
  // Fallback to static OG image on the current origin if env not configured
  const fallbackUrl = new URL("/og-image.png", origin);
  return Response.redirect(fallbackUrl.toString(), 302);
}
