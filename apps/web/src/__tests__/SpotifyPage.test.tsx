// File: apps/web/src/__tests__/SpotifyPage.test.tsx

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { authFetch } from "@/services/spotifyAuthClient";

const { importMutationState, invalidateMock, useMutationMock } = vi.hoisted(
  () => {
    const importMutationState = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
    } as const;

    return {
      importMutationState,
      invalidateMock: vi.fn(),
      useMutationMock: vi.fn(() => importMutationState),
    };
  },
);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1" } },
    status: "authenticated",
  }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("@/utils/haptics", () => ({
  hapticLight: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock("@/utils/spotifyFeatureSettings", () => ({
  extractSpotifyFeatureSettingsFromPreferences: vi.fn(() => ({})),
  getSpotifyFeatureConnectionSummary: vi.fn(() => ({
    state: "unavailable",
    message: null,
    checks: [],
  })),
  maskSpotifyClientId: vi.fn(() => ""),
}));

vi.mock("@/components/SpotifyImportDialog", () => ({
  SpotifyImportDialog: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: () => "div",
    },
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    useUtils: () => ({
      music: {
        getPlaylists: {
          invalidate: invalidateMock,
        },
      },
    }),
    music: {
      getUserPreferences: {
        useQuery: () => ({
          data: null,
          isLoading: false,
        }),
      },
      importSpotifyPlaylist: {
        useMutation: useMutationMock,
      },
    },
  },
  ImportSpotifyPlaylistError: class ImportSpotifyPlaylistError extends Error {
    status = 500;
    payload: unknown = null;
  },
}));

describe("SpotifyPage import auth wiring", () => {
  beforeEach(() => {
    useMutationMock.mockClear();
    invalidateMock.mockClear();
    importMutationState.reset.mockClear();
    importMutationState.mutate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("configures playlist import to use authFetch", async () => {
    const { default: SpotifyPage } = await import("@/app/spotify/page");

    render(<SpotifyPage />);

    expect(useMutationMock).toHaveBeenCalledTimes(1);
    const mutationOptions = (
      useMutationMock.mock.calls as unknown[][]
    )[0]?.[0] as Record<string, unknown> | undefined;
    expect(mutationOptions).toEqual(
      expect.objectContaining({
        fetchImpl: authFetch,
      }),
    );
  });
});
