import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authFetch } from "@/services/spotifyAuthClient";

const {
  createMutationState,
  importMutationState,
  invalidateMock,
  pushMock,
  showToastMock,
  useCreatePlaylistMutationMock,
  useImportM3u8MutationMock,
} = vi.hoisted(() => {
  const createMutationState = {
    mutate: vi.fn(),
    isPending: false,
  };
  const importMutationState = {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  };

  return {
    createMutationState,
    importMutationState,
    invalidateMock: vi.fn(),
    pushMock: vi.fn(),
    showToastMock: vi.fn(),
    useCreatePlaylistMutationMock: vi.fn(() => createMutationState),
    useImportM3u8MutationMock: vi.fn(() => importMutationState),
  };
});

let importMutationOptions:
  | {
      fetchImpl?: typeof fetch;
      onSuccess?: (
        result: {
          ok: true;
          playlistCreated?: boolean;
          playlist?: { id: string; name: string } | null;
          matchedTracks: Array<{
            index: number;
            spotifyTrackId: null;
            deezerTrackId: string;
            deezerTrack: { id: number; title: string };
          }>;
          importReport: {
            sourcePlaylistId: string;
            sourcePlaylistName: string;
            totalTracks: number;
            matchedCount: number;
            unmatchedCount: number;
            skippedCount: number;
            unmatched: Array<{
              index: number;
              spotifyTrackId: null;
              name: string;
              artist: string | null;
              reason: "not_found" | "ambiguous" | "invalid" | "unsupported";
            }>;
          };
        },
        variables: Record<string, unknown>,
      ) => Promise<void> | void;
      onError?: (error: Error) => void;
    }
  | undefined;

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => {
      if (values && Object.keys(values).length > 0) {
        return `${namespace}.${key}`;
      }

      return `${namespace}.${key}`;
    },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1" } },
    status: "authenticated",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock("@/contexts/PlaylistContextMenuContext", () => ({
  usePlaylistContextMenu: () => ({
    openMenu: vi.fn(),
  }),
}));

vi.mock("@/utils/haptics", () => ({
  hapticLight: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({
    action,
    description,
    title,
  }: {
    action?: ReactNode;
    description: string;
    title: string;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div>{action}</div>
    </div>
  ),
}));

vi.mock("@starchild/ui/LoadingSpinner", () => ({
  LoadingState: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
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
      getPlaylists: {
        useQuery: () => ({
          data: [],
          isLoading: false,
        }),
      },
      createPlaylist: {
        useMutation: useCreatePlaylistMutationMock,
      },
      importM3u8Playlist: {
        useMutation: (options: unknown) => {
          importMutationOptions = options as typeof importMutationOptions;
          return useImportM3u8MutationMock(options);
        },
      },
    },
  },
  ImportM3u8PlaylistError: class ImportM3u8PlaylistError extends Error {
    status = 500;
    payload: unknown = null;
  },
}));

describe("PlaylistsPage M3U import", () => {
  beforeEach(() => {
    importMutationOptions = undefined;
    createMutationState.mutate.mockClear();
    importMutationState.mutate.mockClear();
    importMutationState.reset.mockClear();
    invalidateMock.mockClear();
    pushMock.mockClear();
    showToastMock.mockClear();
    useCreatePlaylistMutationMock.mockClear();
    useImportM3u8MutationMock.mockClear();
  });

  it("configures local playlist import to use authFetch", async () => {
    const { default: PlaylistsPage } = await import("@/app/playlists/page");

    render(<PlaylistsPage />);

    expect(useImportM3u8MutationMock).toHaveBeenCalledTimes(1);
    expect(importMutationOptions).toEqual(
      expect.objectContaining({
        fetchImpl: authFetch,
      }),
    );
  });

  it("shows a reading state while loading the uploaded file", async () => {
    const { default: PlaylistsPage } = await import("@/app/playlists/page");

    render(<PlaylistsPage />);

    const fileInput = screen.getByLabelText("playlists.importM3u8");
    const file = new File(["#EXTM3U"], "Roadtrip.m3u8", {
      type: "audio/x-mpegurl",
    });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<string>(() => {
            // Keep pending so the UI stays in the local file-reading state.
          }),
      ),
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(await screen.findByText("playlists.m3u8FileReadingTitle")).toBeVisible();
    expect(importMutationState.mutate).not.toHaveBeenCalled();
  });

  it("uploads a file for preview first and reuses the same payload for create", async () => {
    const { default: PlaylistsPage } = await import("@/app/playlists/page");

    render(<PlaylistsPage />);

    const fileInput = screen.getByLabelText("playlists.importM3u8");
    const file = new File(
      ["#EXTM3U\n#EXTINF:180,Artist - Track One"],
      "Roadtrip.m3u8",
      {
        type: "audio/x-mpegurl",
      },
    );
    Object.defineProperty(file, "text", {
      configurable: true,
      value: vi.fn(async () => "#EXTM3U\n#EXTINF:180,Artist - Track One"),
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(importMutationState.mutate).toHaveBeenCalledWith({
        content: "#EXTM3U\n#EXTINF:180,Artist - Track One",
        sourcePlaylistId: "Roadtrip.m3u8",
        sourcePlaylistName: "Roadtrip",
        playlistName: "Roadtrip",
        createPlaylist: false,
        isPublic: false,
      });
    });

    const previewPayload = importMutationState.mutate.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(previewPayload).toBeDefined();

    await act(async () => {
      await importMutationOptions?.onSuccess?.(
        {
          ok: true,
          playlistCreated: false,
          playlist: null,
          matchedTracks: [
            {
              index: 0,
              spotifyTrackId: null,
              deezerTrackId: "101",
              deezerTrack: {
                id: 101,
                title: "Track One",
              },
            },
          ],
          importReport: {
            sourcePlaylistId: "Roadtrip.m3u8",
            sourcePlaylistName: "Roadtrip",
            totalTracks: 2,
            matchedCount: 1,
            unmatchedCount: 1,
            skippedCount: 0,
            unmatched: [
              {
                index: 1,
                spotifyTrackId: null,
                name: "Missing track",
                artist: "Unknown Artist",
                reason: "not_found",
              },
            ],
          },
        },
        previewPayload ?? {},
      );
    });

    fireEvent.click(await screen.findByText("playlists.m3u8CreatePlaylist"));

    await waitFor(() => {
      expect(importMutationState.mutate).toHaveBeenLastCalledWith({
        content: "#EXTM3U\n#EXTINF:180,Artist - Track One",
        sourcePlaylistId: "Roadtrip.m3u8",
        sourcePlaylistName: "Roadtrip",
        playlistName: "Roadtrip",
        createPlaylist: true,
        isPublic: false,
      });
    });
  });
});
