import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SpotifyAuthCallbackPage from "@/app/auth/spotify/callback/page";

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
  beforeEach(() => {
    vi.restoreAllMocks();
    navigationState.replace.mockClear();
    navigationState.router.replace = navigationState.replace;
    navigationState.searchParams = new URLSearchParams("next=%2Flibrary");
  });

  it("renders the Spotify sign-in removal guidance", () => {
    renderPage();

    expect(
      screen.getByText(
        "Spotify OAuth sign-in has been removed. Use Discord to sign in, and configure Spotify features from Settings instead.",
      ),
    ).toBeInTheDocument();
  });

  it("shows denied authorization copy when access_denied is present", () => {
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&error=access_denied",
    );

    renderPage();

    expect(
      screen.getByText(
        "Spotify authorization was denied. Discord is now the only supported sign-in method.",
      ),
    ).toBeInTheDocument();
  });

  it("routes back to sign-in with the preserved destination", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Sign In" }),
    );

    expect(navigationState.replace).toHaveBeenCalledWith(
      "/signin?callbackUrl=%2Flibrary",
    );
  });
});
