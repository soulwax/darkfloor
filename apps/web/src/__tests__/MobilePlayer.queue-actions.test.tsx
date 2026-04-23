// File: apps/web/src/__tests__/MobilePlayer.queue-actions.test.tsx

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@starchild/types";
import MobilePlayer from "@/components/MobilePlayer";

const mockTrack: Track = {
  id: 12345,
  md5_image: "md5-test-image",
  title: "Test Track",
  title_short: "Test Track",
  readable: true,
  link: "https://example.com/track/12345",
  rank: 1000,
  duration: 180,
  preview: "https://example.com/preview.mp3",
  explicit_lyrics: false,
  explicit_content_lyrics: 0,
  explicit_content_cover: 0,
  type: "track",
  artist: {
    id: 1,
    type: "artist",
    name: "Test Artist",
    picture_medium: "https://example.com/artist.jpg",
  },
  album: {
    id: 1,
    title: "Test Album",
    md5_image: "md5-test-image",
    tracklist: "https://example.com/album/1/tracks",
    type: "album",
    cover_medium: "https://example.com/cover.jpg",
    cover_small: "https://example.com/cover_small.jpg",
    cover_big: "https://example.com/cover_big.jpg",
    cover_xl: "https://example.com/cover_xl.jpg",
    cover: "https://example.com/cover.jpg",
  },
};

const mockQueue: Track[] = [
  mockTrack,
  {
    ...mockTrack,
    id: 12346,
    title: "Second Track",
  },
];

const globalPlayerState = vi.hoisted(() => ({
  audioElement: null,
  addSmartTracks: vi.fn(() => Promise.resolve([])),
  refreshSmartTracks: vi.fn(() => Promise.resolve([])),
  smartQueueState: { isActive: false, isLoading: false },
  queuedTracks: [] as Array<{
    track: Track;
    queueId: string;
    queueSource: "user" | "smart";
  }>,
  playFromQueue: vi.fn(),
  addToPlayNext: vi.fn(),
  removeFromQueue: vi.fn(),
  reorderQueue: vi.fn(),
  saveQueueAsPlaylist: vi.fn(() => Promise.resolve()),
  clearQueue: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (_namespace?: string) =>
    (key: string, values?: Record<string, unknown>) => {
      if (key === "title" && typeof values?.count === "number") {
        return `Queue (${values.count})`;
      }
      return key;
    },
}));

vi.mock("@starchild/player-react/AudioPlayerContext", () => ({
  useGlobalPlayer: () => globalPlayerState,
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/contexts/TrackContextMenuContext", () => ({
  useTrackContextMenu: () => ({ openMenu: vi.fn() }),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    music: {
      getUserPreferences: { useQuery: () => ({ data: null }) },
      getSmartQueueSettings: { useQuery: () => ({ data: null }) },
      isFavorite: { useQuery: () => ({ data: { isFavorite: false } }) },
      getPlaylists: { useQuery: () => ({ data: null, refetch: vi.fn() }) },
      addToPlaylist: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      addFavorite: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      removeFavorite: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    useUtils: () => ({
      music: {
        isFavorite: { invalidate: vi.fn(() => Promise.resolve()) },
        getFavorites: { invalidate: vi.fn(() => Promise.resolve()) },
      },
    }),
  },
}));

vi.mock("@/hooks/useAudioReactiveBackground", () => ({
  useAudioReactiveBackground: () => null,
}));

vi.mock("@/utils/haptics", () => ({
  haptic: vi.fn(),
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticSliderContinuous: vi.fn(),
  hapticSliderEnd: vi.fn(),
}));

vi.mock("@/utils/images", () => ({
  getCoverImage: (track: Track) => track.album?.cover_medium ?? "",
}));

vi.mock("@/utils/time", () => ({
  formatDuration: (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  formatTime: (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
}));

vi.mock("@/utils/spring-animations", () => ({
  springPresets: {
    gentle: { duration: 0.3 },
    snappy: { duration: 0.2 },
    smooth: { duration: 0.4 },
    slider: { duration: 0.1 },
    sliderThumb: { duration: 0.15 },
  },
}));

vi.mock("@/components/MobilePlayerFooterActions", () => ({
  MobilePlayerFooterActions: ({
    onToggleQueuePanel,
  }: {
    onToggleQueuePanel: () => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        onClick: onToggleQueuePanel,
        "aria-label": "queue",
      },
      "queue",
    ),
}));

vi.mock("@starchild/ui", () => ({
  LoadingSpinner: () => React.createElement("div", { "data-testid": "loading-spinner" }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { src, alt, ...rest } = props;
    return React.createElement("img", { src, alt, ...rest });
  },
}));

vi.mock("framer-motion", () => {
  type MotionMockProps = React.HTMLAttributes<HTMLElement> &
    Record<string, unknown>;

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_target, tag: string) =>
          React.forwardRef<HTMLElement, MotionMockProps>(
            ({ children, ...props }, ref) =>
              React.createElement(
                tag,
                { ref, ...props },
                children as React.ReactNode,
              ),
          ),
      },
    ),
    animate: vi.fn(),
    useDragControls: () => ({ start: vi.fn() }),
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useReducedMotion: () => false,
    useTransform: () => ({ get: () => 0 }),
  };
});

describe("MobilePlayer queue actions", () => {
  const defaultProps = {
    currentTrack: mockTrack,
    queue: mockQueue,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    isMuted: false,
    isShuffled: false,
    repeatMode: "none" as const,
    isLoading: false,
    onPlayPause: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSeek: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleShuffle: vi.fn(),
    onCycleRepeat: vi.fn(),
    onSkipForward: vi.fn(),
    onSkipBackward: vi.fn(),
    forceExpanded: true,
  };

  beforeEach(() => {
    globalPlayerState.queuedTracks = mockQueue.map((track, index) => ({
      track,
      queueId: `q-${index}`,
      queueSource: "user",
    }));
    vi.clearAllMocks();
  });

  it("removes a queued track when the remove button receives a touch end", async () => {
    render(<MobilePlayer {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("queue"));

    await waitFor(() => {
      expect(screen.getByText("Queue (2)")).toBeInTheDocument();
    });

    const removeButton = screen.getByLabelText("removeFromQueue");
    fireEvent.touchEnd(removeButton);

    expect(globalPlayerState.removeFromQueue).toHaveBeenCalledWith(1);
  });
});
