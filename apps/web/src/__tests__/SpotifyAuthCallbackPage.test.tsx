import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SpotifyAuthCallbackPage from "@/app/auth/spotify/callback/page";
import { SPOTIFY_MIGRATION_GUIDE_URL } from "@/config/oauthProviders";

const navigationState = vi.hoisted(() => ({
  replace: vi.fn(),
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams("next=%2Flibrary"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationState.router,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

function renderPage() {
  render(<SpotifyAuthCallbackPage />);
}

describe("SpotifyAuthCallbackPage", () => {
  const openSpy = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    navigationState.replace.mockClear();
    navigationState.router.replace = navigationState.replace;
    navigationState.searchParams = new URLSearchParams("next=%2Flibrary");
    openSpy.mockReset();
    vi.stubGlobal("open", openSpy);
  });

  it("renders legacy callback guidance and opens the Spotify migration guide", async () => {
    renderPage();

    expect(
      screen.getByText(
        "Spotify sign-in is now handled through the standard Auth.js callback flow. This legacy callback page is no longer used for normal authentication.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `Fuck you Spotify, instead of logging in, point to: "${SPOTIFY_MIGRATION_GUIDE_URL}"`,
      }),
    );

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        SPOTIFY_MIGRATION_GUIDE_URL,
        "_self",
        undefined,
      );
    });
  });

  it("shows denied authorization copy when access_denied is present", () => {
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&error=access_denied",
    );

    renderPage();

    expect(
      screen.getByText(
        "Spotify authorization was denied. Retry sign-in if you still want to connect Spotify.",
      ),
    ).toBeInTheDocument();
  });

  it("routes back to sign-in with the preserved destination", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Back to Sign In" }));

    expect(navigationState.replace).toHaveBeenCalledWith(
      "/signin?callbackUrl=%2Flibrary",
    );
  });
});
