import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioPlayerProvider,
  useGlobalPlayer,
} from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";

const sessionState = vi.hoisted(() => ({
  data: {
    user: { id: "user-1", name: "Test Listener", email: "test@example.com" },
    expires: new Date(Date.now() + 60_000).toISOString(),
  },
  status: "authenticated",
}));

const queueStateState = vi.hoisted(() => ({
  value: null as
    | {
        queuedTracks: Array<{
          track: Track;
          queueId: string;
          queueSource: "user" | "smart";
          addedAt: string;
        }>;
        smartQueueState: {
          isActive: boolean;
          lastRefreshedAt: string | null;
          seedTrackId: number | null;
          trackCount: number;
        };
        history: Track[];
        currentTime: number;
        isShuffled: boolean;
        repeatMode: "none" | "one" | "all";
      }
    | null,
}));

type SaveQueueStateInput = {
  queueState: {
    currentTime: number;
  };
};

const saveQueueStateMutate = vi.hoisted(() =>
  vi.fn<(input: SaveQueueStateInput) => void>(),
);
const clearQueueStateMutate = vi.hoisted(() => vi.fn());
const addToHistoryMutate = vi.hoisted(() => vi.fn());
const getSimilarTracksFetch = vi.hoisted(() =>
  vi.fn(() => Promise.resolve([])),
);
const invalidatePlaylists = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: sessionState.data,
    status: sessionState.status,
  }),
}));

vi.mock("@starchild/api-client/rest", () => ({
  getStreamUrlById: vi.fn().mockReturnValue("https://example.com/stream.mp3"),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    useUtils: () => ({
      music: {
        getSimilarTracks: {
          fetch: getSimilarTracksFetch,
        },
        getPlaylists: {
          invalidate: invalidatePlaylists,
        },
      },
    }),
    music: {
      addToHistory: {
        useMutation: () => ({
          mutate: addToHistoryMutate,
        }),
      },
      createPlaylist: {
        useMutation: () => ({}),
      },
      addToPlaylist: {
        useMutation: () => ({}),
      },
      getUserPreferences: {
        useQuery: () => ({
          data: {
            keepPlaybackAlive: false,
            streamQuality: "256",
          },
        }),
      },
      getQueueState: {
        useQuery: () => ({
          data: queueStateState.value,
        }),
      },
      saveQueueState: {
        useMutation: () => ({
          mutate: saveQueueStateMutate,
        }),
      },
      clearQueueState: {
        useMutation: () => ({
          mutate: clearQueueStateMutate,
        }),
      },
      getSmartQueueSettings: {
        useQuery: () => ({
          data: null,
        }),
      },
    },
  },
}));

const createTrack = (id: number, title: string): Track => ({
  id,
  readable: true,
  title,
  title_short: title,
  link: `https://example.com/track/${id}`,
  duration: 180,
  rank: 1,
  explicit_lyrics: false,
  explicit_content_lyrics: 0,
  explicit_content_cover: 0,
  preview: "https://example.com/preview.mp3",
  md5_image: "test-md5",
  artist: { id: 10, name: "Test Artist", type: "artist" },
  album: {
    id: 20,
    title: "Test Album",
    cover: "https://example.com/cover.jpg",
    cover_small: "https://example.com/cover.jpg",
    cover_medium: "https://example.com/cover.jpg",
    cover_big: "https://example.com/cover.jpg",
    cover_xl: "https://example.com/cover.jpg",
    md5_image: "album-md5",
    tracklist: "https://example.com/tracklist",
    type: "album",
  },
  type: "track",
});

function PlayerProbe() {
  const player = useGlobalPlayer();

  return (
    <div>
      <div data-testid="current-track">{player.currentTrack?.title ?? "none"}</div>
      <div data-testid="current-time">{String(player.currentTime)}</div>
      <button onClick={() => player.seek(42)}>seek</button>
    </div>
  );
}

describe("AudioPlayerContext persistence", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    queueStateState.value = {
      queuedTracks: [
        {
          track: createTrack(41, "Database Resume"),
          queueId: "db-queue-41",
          queueSource: "user",
          addedAt: new Date("2026-04-21T00:00:00.000Z").toISOString(),
        },
      ],
      smartQueueState: {
        isActive: false,
        lastRefreshedAt: null,
        seedTrackId: null,
        trackCount: 0,
      },
      history: [],
      currentTime: 32,
      isShuffled: false,
      repeatMode: "none",
    };
    saveQueueStateMutate.mockClear();
    clearQueueStateMutate.mockClear();
    addToHistoryMutate.mockClear();
    getSimilarTracksFetch.mockClear();
    invalidatePlaylists.mockClear();
  });

  it("restores currentTime from the authenticated queue state", async () => {
    render(
      <AudioPlayerProvider>
        <PlayerProbe />
      </AudioPlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-track")).toHaveTextContent(
        "Database Resume",
      );
    });

    const audio = document.querySelector<HTMLAudioElement>(
      'audio[data-audio-element="global-player"]',
    );
    expect(audio).not.toBeNull();

    Object.defineProperty(audio!, "duration", {
      configurable: true,
      writable: true,
      value: 180,
    });

    act(() => {
      audio!.dispatchEvent(new Event("loadedmetadata"));
    });

    await waitFor(() => {
      expect(audio!.currentTime).toBe(32);
      expect(screen.getByTestId("current-time")).toHaveTextContent("32");
    });
  });

  it("persists sampled playback progress back to the database", async () => {
    render(
      <AudioPlayerProvider>
        <PlayerProbe />
      </AudioPlayerProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-track")).toHaveTextContent(
        "Database Resume",
      );
    });

    const audio = document.querySelector<HTMLAudioElement>(
      'audio[data-audio-element="global-player"]',
    );
    expect(audio).not.toBeNull();

    Object.defineProperty(audio!, "duration", {
      configurable: true,
      writable: true,
      value: 180,
    });

    act(() => {
      audio!.dispatchEvent(new Event("loadedmetadata"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-time")).toHaveTextContent("32");
    });

    saveQueueStateMutate.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "seek" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-time")).toHaveTextContent("42");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const lastPersistedQueueState =
      saveQueueStateMutate.mock.calls.at(-1)?.[0]?.queueState;

    expect(lastPersistedQueueState?.currentTime).toBe(40);
  });
});
