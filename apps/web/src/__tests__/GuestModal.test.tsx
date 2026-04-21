import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuestModal } from "@/components/GuestModal";

const mocks = vi.hoisted(() => ({
  setLocale: vi.fn(),
  openAuthModal: vi.fn(),
  updatePreferencesMutate: vi.fn(),
  upsertTasteProfileMutate: vi.fn(),
  setPreferenceData: vi.fn(),
  invalidateTasteProfile: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useLocaleSwitcher", () => ({
  useLocaleSwitcher: () => ({
    isPending: false,
    locale: "en",
    options: [
      { label: "English", value: "en" },
      { label: "Deutsch", value: "de" },
    ],
    setLocale: mocks.setLocale,
  }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/contexts/AuthModalContext", () => ({
  useAuthModal: () => ({ openAuthModal: mocks.openAuthModal }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@starchild/api-client/rest", () => ({
  getGenres: vi.fn().mockResolvedValue([{ id: 12, name: "Techno" }]),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    useUtils: () => ({
      music: {
        getUserPreferences: {
          setData: mocks.setPreferenceData,
        },
        getTasteProfile: {
          invalidate: mocks.invalidateTasteProfile,
        },
      },
    }),
    music: {
      getUserPreferences: {
        useQuery: () => ({
          data: {
            autoQueueEnabled: false,
            smartMixEnabled: true,
            similarityPreference: "diverse",
          },
        }),
      },
      getTasteProfile: {
        useQuery: () => ({ data: null }),
      },
      updatePreferences: {
        useMutation: () => ({
          mutate: mocks.updatePreferencesMutate,
        }),
      },
      upsertTasteProfile: {
        useMutation: () => ({
          mutate: mocks.upsertTasteProfileMutate,
        }),
      },
    },
  },
}));

describe("GuestModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("saves greeter tuning changes through signed-in preference mutations", async () => {
    render(<GuestModal />);

    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));

    expect(mocks.setLocale).toHaveBeenCalledWith("de");
    expect(mocks.updatePreferencesMutate).toHaveBeenCalledWith({
      language: "de",
    });

    const hypeButton = screen
      .getByText("moodOptions.hype.label")
      .closest("button");
    expect(hypeButton).not.toBeNull();
    fireEvent.click(hypeButton!);

    expect(mocks.updatePreferencesMutate).toHaveBeenCalledWith({
      autoQueueEnabled: true,
      smartMixEnabled: true,
      similarityPreference: "balanced",
    });

    await waitFor(() =>
      expect(screen.getByRole("combobox")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Techno" }));

    expect(mocks.upsertTasteProfileMutate).toHaveBeenCalledWith({
      preferredGenreId: 12,
      preferredGenreName: "Techno",
    });
  });

  it("keeps the greeter, OAuth CTA, and cookie notice in one intro card", async () => {
    render(<GuestModal />);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).not.toBeDisabled(),
    );

    const introCard = screen.getByTestId("guest-modal-intro");

    expect(
      within(introCard).getByRole("button", { name: "signInToSync" }),
    ).toBeInTheDocument();
    expect(within(introCard).getByText("inlineNotice")).toBeInTheDocument();

    fireEvent.click(
      within(introCard).getByRole("button", { name: "signInToSync" }),
    );

    expect(mocks.openAuthModal).toHaveBeenCalledWith({
      callbackUrl: "/library",
    });
  });
});
