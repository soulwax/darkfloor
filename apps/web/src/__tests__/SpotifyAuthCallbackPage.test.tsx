import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SpotifyAuthCallbackPage from "@/app/auth/spotify/callback/page";

const navigationState = vi.hoisted(() => ({
  replace: vi.fn(),
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams("next=%2Flibrary"),
}));

const nextAuthState = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationState.router,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("next-auth/react", () => ({
  signIn: nextAuthState.signIn,
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
    nextAuthState.signIn.mockReset();
    nextAuthState.signIn.mockResolvedValue(undefined);
  });

  it("renders legacy callback guidance and retries through Auth.js", async () => {
    renderPage();

    expect(
      screen.getByText(
        "Spotify sign-in is now handled through the standard Auth.js callback flow. This legacy callback page is no longer used for normal authentication.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry Spotify Sign-In" }),
    );

    await waitFor(() => {
      expect(nextAuthState.signIn).toHaveBeenCalledWith("spotify", {
        callbackUrl: "/auth/callback?next=%2Flibrary&provider=spotify",
      });
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
