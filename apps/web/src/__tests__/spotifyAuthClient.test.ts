// File: apps/web/src/__tests__/spotifyAuthClient.test.ts

import {
  AUTH_REQUIRED_EVENT,
  buildSpotifyBrowserSignInUrl,
  buildSpotifyLoginUrl,
  clearInMemoryAccessToken,
  clearSpotifyBrowserSessionArtifacts,
  getCsrfTokenFromCookies,
  getInMemoryAccessToken,
  handleSpotifyCallbackHash,
  hasSpotifyTokenHashFragment,
  refreshAccessToken,
  restoreSpotifySession,
  resolveFrontendRedirectPath,
  startSpotifyLogin,
} from "@/services/spotifyAuthClient";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("spotifyAuthClient", () => {
  const expectedAuthOrigin = () => window.location.origin;
  const expectedAuthMeEndpoint = () => `${window.location.origin}/api/auth/me`;
  const expectedRefreshEndpoint = () =>
    `${window.location.origin}/api/auth/spotify/refresh`;

  beforeEach(() => {
    clearInMemoryAccessToken();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("builds login URL with frontend callback URI", () => {
    window.history.replaceState({}, "", "/signin");
    const loginUrl = buildSpotifyLoginUrl("/playlists?tab=mine");
    const parsed = new URL(loginUrl, window.location.origin);
    const frontendRedirect = parsed.searchParams.get("frontend_redirect_uri");

    expect(parsed.origin).toBe(expectedAuthOrigin());
    expect(parsed.pathname).toBe("/api/auth/spotify");
    expect(frontendRedirect).toContain("/auth/spotify/callback");
    expect(frontendRedirect).toContain("next=%2Fplaylists%3Ftab%3Dmine");
    expect(frontendRedirect).toContain("trace=");
  });

  it("builds browser sign-in shim URL with callback and trace", () => {
    window.history.replaceState({}, "", "/signin");
    const signInUrl = buildSpotifyBrowserSignInUrl("/playlists?tab=mine");
    const parsed = new URL(signInUrl, window.location.origin);

    expect(parsed.origin).toBe(window.location.origin);
    expect(parsed.pathname).toBe("/api/auth/signin/spotify");
    expect(parsed.searchParams.get("callbackUrl")).toBe("/playlists?tab=mine");
    expect(parsed.searchParams.get("trace")).toBeTruthy();
  });

  it("prefers configured auth API origin when env override is provided", () => {
    const previous = process.env.NEXT_PUBLIC_AUTH_API_ORIGIN;
    process.env.NEXT_PUBLIC_AUTH_API_ORIGIN = "https://auth.example.com/";

    try {
      const loginUrl = buildSpotifyLoginUrl("/playlists?tab=mine");
      const parsed = new URL(loginUrl, window.location.origin);
      expect(parsed.origin).toBe("https://auth.example.com");
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_AUTH_API_ORIGIN;
      } else {
        process.env.NEXT_PUBLIC_AUTH_API_ORIGIN = previous;
      }
    }
  });

  it("starts Spotify login on canonical auth origin", () => {
    window.history.replaceState({}, "", "/signin");
    const navigateSpy = vi.fn<(url: string) => void>();

    startSpotifyLogin("/playlists?tab=mine", navigateSpy);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const navigatedUrl = navigateSpy.mock.calls[0]?.[0];
    expect(typeof navigatedUrl).toBe("string");

    const parsed = new URL(String(navigatedUrl), window.location.origin);
    expect(parsed.origin).toBe(expectedAuthOrigin());
    expect(parsed.pathname).toBe("/api/auth/spotify");

    const frontendRedirect = parsed.searchParams.get("frontend_redirect_uri");
    expect(frontendRedirect).toContain("/auth/spotify/callback");
    expect(frontendRedirect).toContain("next=%2Fplaylists%3Ftab%3Dmine");
    expect(frontendRedirect).toContain("trace=");
  });

  it("normalizes root post-auth destinations to /library", () => {
    window.history.replaceState({}, "", "/signin");
    const loginUrl = buildSpotifyLoginUrl("/");
    const parsed = new URL(loginUrl, window.location.origin);
    const frontendRedirect = parsed.searchParams.get("frontend_redirect_uri");

    expect(frontendRedirect).toBeTruthy();
    const callbackUrl = new URL(
      frontendRedirect ?? "https://www.darkfloor.org/auth/spotify/callback",
    );
    expect(callbackUrl.searchParams.get("next")).toBe("/library");
  });

  it("sanitizes redirect destinations to same-origin paths", () => {
    expect(resolveFrontendRedirectPath("/library")).toBe("/library");
    expect(resolveFrontendRedirectPath("/")).toBe("/library");
    expect(resolveFrontendRedirectPath("https://evil.example/phish")).toBe(
      "/library",
    );
  });

  it("extracts csrf token from cookies", () => {
    const token = getCsrfTokenFromCookies("a=1; sb_csrf_token=csrf-123; b=2");
    expect(token).toBe("csrf-123");
  });

  it("clears in-memory/session auth state and trace artifacts", () => {
    window.sessionStorage.setItem(
      "sb_spotify_auth_state_v1",
      JSON.stringify({
        accessToken: "token-1",
        tokenType: "Bearer",
        expiresAtMs: Date.now() + 60_000,
        spotifyAccessToken: null,
        spotifyTokenType: "Bearer",
        spotifyExpiresAtMs: null,
      }),
    );
    window.sessionStorage.setItem("sb_spotify_auth_trace_v1", "trace-1");
    document.cookie = "sb_csrf_token=csrf-1; path=/";

    clearSpotifyBrowserSessionArtifacts();

    expect(getInMemoryAccessToken()).toBeNull();
    expect(
      window.sessionStorage.getItem("sb_spotify_auth_state_v1"),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem("sb_spotify_auth_trace_v1"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("sb_spotify_logout_marker_v1"),
    ).not.toBeNull();
  });

  it("prevents silent refresh after explicit sign-out marker is set", async () => {
    clearSpotifyBrowserSessionArtifacts();
    const fetchMock = vi.spyOn(global, "fetch");

    const token = await restoreSpotifySession();

    expect(token).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears logout marker when login is started again", () => {
    clearSpotifyBrowserSessionArtifacts();
    expect(
      window.localStorage.getItem("sb_spotify_logout_marker_v1"),
    ).not.toBeNull();

    const navigateSpy = vi.fn<(url: string) => void>();
    startSpotifyLogin("/library", navigateSpy);

    expect(
      window.localStorage.getItem("sb_spotify_logout_marker_v1"),
    ).toBeNull();
  });

  it("detects token hashes used for callback recovery", () => {
    expect(hasSpotifyTokenHashFragment("#access_token=abc")).toBe(true);
    expect(hasSpotifyTokenHashFragment("#spotify_access_token=abc")).toBe(true);
    expect(hasSpotifyTokenHashFragment("#state=xyz")).toBe(false);
  });

  it("handles callback hash and validates /api/auth/me", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary#access_token=app-token-1&token_type=Bearer&expires_in=3600&spotify_access_token=spotify-token-1&spotify_token_type=Bearer&spotify_expires_in=3600",
    );

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await handleSpotifyCallbackHash();

    expect(result.accessToken).toBe("app-token-1");
    expect(getInMemoryAccessToken()).toBe("app-token-1");
    expect(window.location.hash).toBe("");

    const callbackFetchCall = fetchMock.mock.calls[0] as
      | [RequestInfo | URL, RequestInit | undefined]
      | undefined;
    expect(callbackFetchCall).toBeDefined();
    if (!callbackFetchCall) {
      throw new Error("Expected callback /api/auth/me request");
    }

    expect(callbackFetchCall[0]).toBe(expectedAuthMeEndpoint());
    const callbackInit = callbackFetchCall[1] ?? {};
    expect(callbackInit.method).toBe("GET");
    expect(callbackInit.credentials).toBe("include");

    const callbackHeaders = new Headers(callbackInit.headers);
    expect(callbackHeaders.get("accept")).toBe("application/json");
    expect(callbackHeaders.get("authorization")).toBe("Bearer app-token-1");
  });

  it("accepts callback hash when Spotify token fields are absent", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary#access_token=app-token-optional&token_type=Bearer&expires_in=3600",
    );

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-optional" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await handleSpotifyCallbackHash();
    expect(result.accessToken).toBe("app-token-optional");
    expect(getInMemoryAccessToken()).toBe("app-token-optional");
  });

  it("emits auth-required event and clears token on refresh 401", async () => {
    document.cookie = "sb_csrf_token=csrf-refresh-token; path=/";
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary#access_token=app-token-1&token_type=Bearer&expires_in=3600&spotify_access_token=spotify-token-1&spotify_token_type=Bearer&spotify_expires_in=3600",
    );

    const authRequiredListener = vi.fn();
    window.addEventListener(
      AUTH_REQUIRED_EVENT,
      authRequiredListener as EventListener,
    );

    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );

    await handleSpotifyCallbackHash();
    expect(getInMemoryAccessToken()).toBe("app-token-1");

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(Error);
    expect(getInMemoryAccessToken()).toBeNull();
    expect(authRequiredListener).toHaveBeenCalledTimes(1);

    const authRequiredEvent = authRequiredListener.mock
      .calls[0]?.[0] as CustomEvent<{
      callbackUrl: string;
      reason: string;
    }>;
    expect(authRequiredEvent.detail.callbackUrl).toBe("/library");
    expect(authRequiredEvent.detail.reason).toBe("unauthorized");

    window.removeEventListener(
      AUTH_REQUIRED_EVENT,
      authRequiredListener as EventListener,
    );
  });

  it("refreshes access token using csrf header", async () => {
    document.cookie = "sb_csrf_token=csrf-refresh-token; path=/";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "new-access-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const refreshed = await refreshAccessToken();

    expect(refreshed).toBe("new-access-token");
    expect(getInMemoryAccessToken()).toBe("new-access-token");

    const refreshFetchCall = fetchMock.mock.calls[0] as
      | [RequestInfo | URL, RequestInit | undefined]
      | undefined;
    expect(refreshFetchCall).toBeDefined();
    if (!refreshFetchCall) {
      throw new Error("Expected refresh request");
    }

    expect(refreshFetchCall[0]).toBe(expectedRefreshEndpoint());
    const refreshInit = refreshFetchCall[1] ?? {};
    expect(refreshInit.method).toBe("POST");
    expect(refreshInit.credentials).toBe("include");

    const refreshHeaders = new Headers(refreshInit.headers);
    expect(refreshHeaders.get("accept")).toBe("application/json");
    expect(refreshHeaders.get("x-csrf-token")).toBe("csrf-refresh-token");
  });

  it("restores spotify session from sessionStorage without csrf cookie", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary#access_token=app-token-2&token_type=Bearer&expires_in=3600&spotify_access_token=spotify-token-2&spotify_token_type=Bearer&spotify_expires_in=3600",
    );

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await handleSpotifyCallbackHash();
    expect(getInMemoryAccessToken()).toBe("app-token-2");

    clearInMemoryAccessToken();
    expect(getInMemoryAccessToken()).toBeNull();

    window.sessionStorage.setItem(
      "sb_spotify_auth_state_v1",
      JSON.stringify({
        accessToken: "app-token-2",
        tokenType: "Bearer",
        expiresAtMs: Date.now() + 3_600_000,
        spotifyAccessToken: null,
        spotifyTokenType: "Bearer",
        spotifyExpiresAtMs: null,
      }),
    );

    const restored = await restoreSpotifySession();
    expect(restored).toBe(true);
    expect(getInMemoryAccessToken()).toBe("app-token-2");
  });

  it("rejects callback when required token hash keys are missing", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary&trace=trace-missing#access_token=token-only",
    );

    try {
      await handleSpotifyCallbackHash();
      throw new Error("Expected callback hash validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const typedError = error as {
        status?: number;
        debugInfo?: {
          traceId?: string | null;
          authorizationHeaderSent?: boolean;
          authMeStatus?: number | null;
        } | null;
      };

      expect(typedError.status).toBe(401);
      expect(typedError.debugInfo?.traceId).toBe("trace-missing");
      expect(typedError.debugInfo?.authorizationHeaderSent).toBe(false);
      expect(typedError.debugInfo?.authMeStatus).toBeNull();
    }
  });
});
