// File: apps/web/src/__tests__/SpotifyAuthCallbackPage.test.tsx

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SpotifyAuthCallbackPage from "@/app/auth/spotify/callback/page";

const navigationState = vi.hoisted(() => ({
  replace: vi.fn(),
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams("next=%2Flibrary"),
}));

const spotifyAuthClientState = vi.hoisted(() => ({
  handleSpotifyCallbackHash: vi.fn(),
  startSpotifyLogin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationState.router,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("@/services/spotifyAuthClient", () => ({
  handleSpotifyCallbackHash: spotifyAuthClientState.handleSpotifyCallbackHash,
  startSpotifyLogin: spotifyAuthClientState.startSpotifyLogin,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const translations: Record<string, string> = {
      "auth.spotifyCallbackLoading": "Loading Spotify authentication callback",
      "auth.spotifyCallbackPreparing":
        "Preparing Spotify authentication callback...",
      "auth.spotifyDenied":
        "Spotify authorization was denied. Discord is now the only supported sign-in method.",
      "auth.spotifyConnectionFailed":
        "Spotify playlist connection could not be completed. Try again.",
      "common.retry": "Try Again",
      "common.continueToApp": "Continue to App",
    };

    return translations[`${namespace}.${key}`] ?? key;
  },
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
    spotifyAuthClientState.handleSpotifyCallbackHash.mockReset();
    spotifyAuthClientState.startSpotifyLogin.mockReset();
  });

  it("finishes the playlist auth callback and returns to the requested page", async () => {
    spotifyAuthClientState.handleSpotifyCallbackHash.mockResolvedValue({
      accessToken: "app-token-1",
      spotifyAccessTokenPresent: true,
      profile: { id: "spotify-user-1" },
    });

    renderPage();

    await waitFor(() => {
      expect(navigationState.replace).toHaveBeenCalledWith("/library");
    });
  });

  it("shows profile-auth denial copy when Spotify consent is rejected", async () => {
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&error=access_denied",
    );
    spotifyAuthClientState.handleSpotifyCallbackHash.mockRejectedValue(
      new Error("Callback hash missing required token keys: access_token"),
    );

    renderPage();

    expect(
      await screen.findByText(
        "Spotify authorization was denied. Discord is now the only supported sign-in method.",
      ),
    ).toBeInTheDocument();
  });

  it("lets the user retry the playlist auth flow after a callback error", async () => {
    spotifyAuthClientState.handleSpotifyCallbackHash.mockRejectedValue(
      new Error(
        "Spotify playlist connection could not be completed. Try again.",
      ),
    );

    renderPage();

    await screen.findByText(
      "Spotify playlist connection could not be completed. Try again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(spotifyAuthClientState.startSpotifyLogin).toHaveBeenCalledWith(
      "/library",
    );
  });
});
