// File: apps/web/src/__tests__/SpotifyAuthCallbackPage.test.tsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpotifyAuthCallbackPage from "@/app/auth/spotify/callback/page";

const navigationState = vi.hoisted(() => ({
  replace: vi.fn(),
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams("next=%2Flibrary"),
}));

const authState = vi.hoisted(() => ({
  SpotifyAuthClientError: class MockSpotifyAuthClientError extends Error {
    status: number | null;
    debugInfo: unknown;

    constructor(
      message: string,
      status: number | null = null,
      debugInfo: unknown = null,
    ) {
      super(message);
      this.status = status;
      this.debugInfo = debugInfo;
    }
  },
  handleSpotifyCallbackHash: vi.fn(),
  resolveFrontendRedirectPath: vi.fn((next: string | null | undefined) => {
    void next;
    return "/library";
  }),
  startSpotifyLogin: vi.fn(),
}));

const debugState = vi.hoisted(() => ({
  isClientAuthDebugEnabled: vi.fn(() => false),
  logAuthClientDebug: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationState.router,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("@/services/spotifyAuthClient", () => {
  return {
    SpotifyAuthClientError: authState.SpotifyAuthClientError,
    handleSpotifyCallbackHash: authState.handleSpotifyCallbackHash,
    resolveFrontendRedirectPath: authState.resolveFrontendRedirectPath,
    startSpotifyLogin: authState.startSpotifyLogin,
  };
});

vi.mock("@/utils/authDebugClient", () => ({
  isClientAuthDebugEnabled: debugState.isClientAuthDebugEnabled,
  logAuthClientDebug: debugState.logAuthClientDebug,
}));

function renderPage() {
  render(<SpotifyAuthCallbackPage />);
}

describe("SpotifyAuthCallbackPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigationState.replace.mockClear();
    navigationState.router.replace = navigationState.replace;
    navigationState.searchParams = new URLSearchParams("next=%2Flibrary");
    window.history.replaceState({}, "", "/auth/spotify/callback?next=%2Flibrary");
    authState.handleSpotifyCallbackHash.mockReset();
    authState.handleSpotifyCallbackHash.mockResolvedValue({
      accessToken: "token",
      spotifyAccessTokenPresent: false,
      profile: { id: "user-1" },
    });
    authState.startSpotifyLogin.mockClear();
    debugState.isClientAuthDebugEnabled.mockReturnValue(false);
    debugState.logAuthClientDebug.mockClear();
    process.env.NEXT_PUBLIC_AUTH_DEBUG = "0";
  });

  it("redirects to next path when callback handling succeeds", async () => {
    renderPage();

    await waitFor(() => {
      expect(authState.handleSpotifyCallbackHash).toHaveBeenCalledTimes(1);
      expect(navigationState.replace).toHaveBeenCalledWith("/library");
    });
  });

  it("logs callback parsing and persistence before redirect", async () => {
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&access_token=app-token-query&expires_in=3600&spotify_access_token=spotify-token-query&spotify_token_type=Bearer&spotify_expires_in=3600",
    );
    window.history.replaceState(
      {},
      "",
      "/auth/spotify/callback?next=%2Flibrary&access_token=app-token-query&expires_in=3600&spotify_access_token=spotify-token-query&spotify_token_type=Bearer&spotify_expires_in=3600#access_token=app-token-hash&expires_in=3600&spotify_access_token=spotify-token-hash&spotify_token_type=Bearer&spotify_expires_in=3600",
    );
    authState.handleSpotifyCallbackHash.mockResolvedValueOnce({
      accessToken: "token",
      spotifyAccessTokenPresent: true,
      profile: { id: "user-1" },
    });

    renderPage();

    await waitFor(() => {
      expect(navigationState.replace).toHaveBeenCalledWith("/library");
    });

    const loggedMessages = debugState.logAuthClientDebug.mock.calls.map(
      ([message]) => message,
    );

    expect(loggedMessages).toContain("callback mounted");
    expect(loggedMessages).toContain("search params parsed");
    expect(loggedMessages).toContain("hash parsed");
    expect(loggedMessages).toContain("access_token present");
    expect(loggedMessages).toContain("spotify_access_token present");
    expect(loggedMessages).toContain("tokens persisted");
    expect(loggedMessages).toContain("redirecting to next");
  });

  it("shows denied message and retry action for access_denied errors", async () => {
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&error=access_denied",
    );

    renderPage();

    expect(
      await screen.findByText(
        "Spotify authorization was denied. Please try again and accept consent.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry Spotify Sign-In" }));
    expect(authState.startSpotifyLogin).toHaveBeenCalledWith("/library");
  });

  it("renders debug panel when callback auth/me validation fails", async () => {
    process.env.NEXT_PUBLIC_AUTH_DEBUG = "1";
    debugState.isClientAuthDebugEnabled.mockReturnValue(true);

    authState.handleSpotifyCallbackHash.mockRejectedValueOnce(
      new authState.SpotifyAuthClientError("Unauthorized", 401, {
        traceId: "trace-123",
        requiredHashKeys: {
          access_token: true,
          token_type: true,
          expires_in: true,
          spotify_access_token: true,
          spotify_token_type: true,
          spotify_expires_in: true,
        },
        missingHashKeys: [],
        authorizationHeaderSent: true,
        authMeStatus: 401,
        authMeBodySnippet: "{\"message\":\"Unauthorized\"}",
        authMeUrl: "https://www.darkfloor.one/api/auth/me",
        authMeRedirected: false,
        authMeFinalUrl: "https://www.darkfloor.one/api/auth/me",
      }),
    );

    renderPage();

    expect(await screen.findByText("OAuth Debug Panel")).toBeInTheDocument();
    expect(screen.getAllByText(/trace-123/).length).toBeGreaterThan(0);
    expect(screen.getByText(/401/)).toBeInTheDocument();
  });
});
