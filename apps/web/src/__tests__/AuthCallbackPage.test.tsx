// File: apps/web/src/__tests__/AuthCallbackPage.test.tsx

import AuthCallbackPage from "@/app/auth/callback/page";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams("next=%2Flibrary&provider=spotify"),
}));

const sessionState = vi.hoisted(() => ({
  status: "loading" as "loading" | "authenticated" | "unauthenticated",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigationState.replace }),
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: sessionState.status }),
}));

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    sessionState.status = "loading";
    navigationState.searchParams = new URLSearchParams(
      "next=%2Flibrary&provider=spotify",
    );
    navigationState.replace.mockClear();
  });

  it("shows spinner text while authentication is in progress", () => {
    render(<AuthCallbackPage />);

    expect(
      screen.getByText("Authenticating with Spotify..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Authenticating with Spotify" }),
    ).toBeInTheDocument();
  });

  it("redirects to the post-auth destination when session is ready", async () => {
    sessionState.status = "authenticated";

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(navigationState.replace).toHaveBeenCalledWith("/library");
    });
  });
});
