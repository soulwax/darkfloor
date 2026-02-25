// File: apps/web/src/__tests__/MobilePlayer.integrated-controls.test.tsx

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
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

const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const mockPlaylists = [
  { id: 1, name: "My Playlist", trackCount: 5 },
  { id: 2, name: "Favorites", trackCount: 10 },
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
  removeFromQueue: vi.fn(),
  reorderQueue: vi.fn(),
  saveQueueAsPlaylist: vi.fn(() => Promise.resolve()),
  clearQueue: vi.fn(),
  clearSmartTracks: vi.fn(),
}));

const sessionState = vi.hoisted(() => ({
  data: null as typeof mockSession | null,
}));

const apiState = vi.hoisted(() => ({
  playlists: null as typeof mockPlaylists | null,
  favoriteData: { isFavorite: false },
  addToPlaylistMutate: vi.fn(),
  addFavoriteMutate: vi.fn(),
  removeFavoriteMutate: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: sessionState.data }),
}));

vi.mock("@starchild/player-react/AudioPlayerContext", () => ({
  useGlobalPlayer: () => globalPlayerState,
}));

vi.mock("@starchild/ui", () => ({
  LoadingSpinner: () => React.createElement("div", { "data-testid": "loading-spinner" }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    music: {
      getUserPreferences: {
        useQuery: () => ({ data: null }),
      },
      getSmartQueueSettings: {
        useQuery: () => ({ data: null }),
      },
      isFavorite: {
        useQuery: () => ({ data: apiState.favoriteData }),
      },
      getPlaylists: {
        useQuery: () => ({
          data: apiState.playlists,
          refetch: vi.fn(),
        }),
      },
      addToPlaylist: {
        useMutation: () => ({
          mutate: apiState.addToPlaylistMutate,
          isPending: false,
        }),
      },
      addFavorite: {
        useMutation: () => ({
          mutate: apiState.addFavoriteMutate,
          isPending: false,
        }),
      },
      removeFavorite: {
        useMutation: () => ({
          mutate: apiState.removeFavoriteMutate,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      music: {
        isFavorite: {
          invalidate: vi.fn(() => Promise.resolve()),
        },
        getFavorites: {
          invalidate: vi.fn(() => Promise.resolve()),
        },
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

vi.mock("@/utils/spring-animations", () => ({
  springPresets: {
    gentle: { duration: 0.3 },
    snappy: { duration: 0.2 },
    smooth: { duration: 0.4 },
    slider: { duration: 0.1 },
    sliderThumb: { duration: 0.15 },
  },
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

vi.mock("@/utils/colorExtractor", () => ({
  extractColorsFromImage: () =>
    Promise.resolve({
      primary: "rgba(100, 149, 237, 0.8)",
      secondary: "rgba(135, 206, 250, 0.8)",
      accent: "rgba(70, 130, 180, 0.8)",
      hue: 210,
      saturation: 60,
      lightness: 65,
    }),
}));

vi.mock("@starchild/audio-adapters/web/audioContextManager", () => ({
  getAudioConnection: vi.fn(() => null),
  getOrCreateAudioConnection: vi.fn(() => null),
  releaseAudioConnection: vi.fn(),
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
  const motion = new Proxy(
    {},
    {
      get: (_target, tag) => {
        const componentTag = typeof tag === "string" ? tag : "div";
        return (() => {
          const MotionComponent = React.forwardRef(
            (props: MotionMockProps, ref) => {
              const {
                layoutId,
                whileTap,
                whileHover,
                transition,
                initial,
                animate,
                exit,
                drag,
                dragConstraints,
                dragElastic,
                dragControls,
                dragListener,
                dragMomentum,
                onDrag,
                onDragEnd,
                style,
                ...rest
              } = props;
              void layoutId;
              void whileTap;
              void whileHover;
              void transition;
              void initial;
              void animate;
              void exit;
              void drag;
              void dragConstraints;
              void dragElastic;
              void dragControls;
              void dragListener;
              void dragMomentum;
              void onDrag;
              void onDragEnd;
              return React.createElement(componentTag, {
                ...rest,
                ...(style ? { style } : {}),
                ref,
              });
            },
          );
          MotionComponent.displayName = `motion.${String(tag)}`;
          return MotionComponent;
        })();
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, {}, children),
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useDragControls: () => ({ start: vi.fn() }),
    useReducedMotion: () => false,
  };
});

vi.mock("@/components/QueueSettingsModal", () => ({
  QueueSettingsModal: () => null,
}));

describe("MobilePlayer - Integrated Controls", () => {
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
    sessionState.data = null;
    apiState.playlists = null;
    apiState.favoriteData = { isFavorite: false };
    globalPlayerState.queuedTracks = mockQueue.map((track, i) => ({
      track,
      queueId: `q-${i}`,
      queueSource: "user",
    }));
    vi.clearAllMocks();
  });

  describe("Controls Integration", () => {
    it("renders queue button within the main controls section", () => {
      render(<MobilePlayer {...defaultProps} />);

      const queueButton = screen.getByLabelText("Show queue");
      expect(queueButton).toBeInTheDocument();

      const queueIcon = queueButton.querySelector("svg");
      expect(queueIcon).toBeInTheDocument();
    });

    it("displays queue count badge when queue has items", () => {
      render(<MobilePlayer {...defaultProps} />);

      const queueButton = screen.getByLabelText("Show queue");
      const badge = within(queueButton).getByText("2");
      expect(badge).toBeInTheDocument();
    });

    it("renders add to playlist button within the main controls section", () => {
      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText(
        "Sign in to add to playlists",
      );
      expect(playlistButton).toBeInTheDocument();
    });

    it("renders favorite button within the main controls section", () => {
      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText(
        "Sign in to favorite tracks",
      );
      expect(favoriteButton).toBeInTheDocument();
    });

    it("displays all three action buttons in a row", () => {
      render(<MobilePlayer {...defaultProps} />);

      const queueButton = screen.getByLabelText("Show queue");
      const playlistButton = screen.getByLabelText(
        "Sign in to add to playlists",
      );
      const favoriteButton = screen.getByLabelText(
        "Sign in to favorite tracks",
      );

      const queueParent = queueButton.closest('[class*="flex"]');
      const playlistParent = playlistButton.closest('[class*="flex"]');
      const favoriteParent = favoriteButton.closest('[class*="flex"]');

      expect(queueParent).toBe(playlistParent);
      expect(playlistParent).toBe(favoriteParent);
    });
  });

  describe("Queue Button Functionality", () => {
    it("opens queue panel when queue button is clicked", async () => {
      render(<MobilePlayer {...defaultProps} />);

      const queueButton = screen.getByLabelText("Show queue");
      fireEvent.click(queueButton);

      await waitFor(() => {
        expect(screen.getByText(/Queue \(2\)/i)).toBeInTheDocument();
      });
    });

    it("changes queue button appearance when queue panel is open", async () => {
      render(<MobilePlayer {...defaultProps} />);

      const getQueueButton = () => screen.getByLabelText("Show queue");
      expect(getQueueButton().getAttribute("class") ?? "").not.toContain(
        "text-[var(--color-accent)]",
      );

      fireEvent.click(getQueueButton());

      await waitFor(() => {
        expect(getQueueButton().getAttribute("class") ?? "").toContain(
          "text-[var(--color-accent)]",
        );
      });
    });
  });

  describe("Add to Playlist Button - Authentication", () => {
    it("shows disabled state when user is not authenticated", () => {
      sessionState.data = null;
      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText(
        "Sign in to add to playlists",
      );
      expect(playlistButton.className).toContain("opacity-50");
      expect(playlistButton.title).toBe("Sign in to add to playlists");
    });

    it("enables button when user is authenticated", () => {
      sessionState.data = mockSession;
      apiState.playlists = mockPlaylists;

      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText("Add to playlist");
      expect(playlistButton.className).not.toContain("opacity-50");
      expect(playlistButton.title).toBe("Add to playlist");
    });

    it("shows playlist selector when authenticated user clicks button", async () => {
      sessionState.data = mockSession;
      apiState.playlists = mockPlaylists;

      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText("Add to playlist");
      fireEvent.click(playlistButton);

      await waitFor(() => {
        expect(screen.getByText("Add to Playlist")).toBeInTheDocument();
        expect(screen.getByText("My Playlist")).toBeInTheDocument();
        expect(screen.getByText("Favorites")).toBeInTheDocument();
      });
    });

    it("calls addToPlaylist mutation when playlist is selected", async () => {
      sessionState.data = mockSession;
      apiState.playlists = mockPlaylists;

      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText("Add to playlist");
      fireEvent.click(playlistButton);

      await waitFor(() => {
        expect(screen.getByText("My Playlist")).toBeInTheDocument();
      });

      const playlistOption = screen.getByText("My Playlist");
      fireEvent.click(playlistOption);

      expect(apiState.addToPlaylistMutate).toHaveBeenCalledWith({
        playlistId: 1,
        track: mockTrack,
      });
    });

    it("displays 'No playlists yet' message when user has no playlists", async () => {
      sessionState.data = mockSession;
      apiState.playlists = [];

      render(<MobilePlayer {...defaultProps} />);

      const playlistButton = screen.getByLabelText("Add to playlist");
      fireEvent.click(playlistButton);

      await waitFor(() => {
        expect(screen.getByText("No playlists yet")).toBeInTheDocument();
        expect(
          screen.getByText("Create one from the Playlists page"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Favorite Button - Authentication", () => {
    it("shows disabled state when user is not authenticated", () => {
      sessionState.data = null;
      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText(
        "Sign in to favorite tracks",
      );
      expect(favoriteButton.className).toContain("opacity-50");
    });

    it("enables button when user is authenticated", () => {
      sessionState.data = mockSession;
      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText("Add to favorites");
      expect(favoriteButton.className).not.toContain("opacity-50");
    });

    it("calls addFavorite mutation when unfavorited track is clicked", () => {
      sessionState.data = mockSession;
      apiState.favoriteData = { isFavorite: false };

      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText("Add to favorites");
      fireEvent.click(favoriteButton);

      expect(apiState.addFavoriteMutate).toHaveBeenCalledWith({
        track: mockTrack,
      });
    });

    it("calls removeFavorite mutation when favorited track is clicked", () => {
      sessionState.data = mockSession;
      apiState.favoriteData = { isFavorite: true };

      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText("Remove from favorites");
      fireEvent.click(favoriteButton);

      expect(apiState.removeFavoriteMutate).toHaveBeenCalledWith({
        trackId: mockTrack.id,
      });
    });

    it("shows filled heart icon when track is favorited", () => {
      sessionState.data = mockSession;
      apiState.favoriteData = { isFavorite: true };

      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText("Remove from favorites");
      const heartIcon = favoriteButton.querySelector("svg");

      expect(heartIcon?.getAttribute("class") ?? "").toContain("fill-current");
    });

    it("shows outlined heart icon when track is not favorited", () => {
      sessionState.data = mockSession;
      apiState.favoriteData = { isFavorite: false };

      render(<MobilePlayer {...defaultProps} />);

      const favoriteButton = screen.getByLabelText("Add to favorites");
      const heartIcon = favoriteButton.querySelector("svg");

      expect(heartIcon?.getAttribute("class") ?? "").not.toContain("fill-current");
    });
  });

  describe("Visual Layout", () => {
    it("renders footer actions inside the pinned footer container", () => {
      render(<MobilePlayer {...defaultProps} />);

      const footerActions = screen.getByTestId("mobile-player-footer-actions");
      const queueButton = screen.getByLabelText("Show queue");

      expect(footerActions).toBeInTheDocument();
      expect(footerActions.contains(queueButton)).toBe(true);
      expect(footerActions.parentElement?.className).toContain(
        "backdrop-blur-xl",
      );
    });

    it("displays horizontal divider between main controls and action buttons", () => {
      const { container } = render(<MobilePlayer {...defaultProps} />);

      const dividers = container.querySelectorAll('[class*="h-[2px]"]');
      expect(dividers.length).toBeGreaterThan(0);
    });

    it("keeps footer actions separate from playback controls", () => {
      render(<MobilePlayer {...defaultProps} />);

      const playButton = screen.getByLabelText(/play track/i);
      const footerActions = screen.getByTestId("mobile-player-footer-actions");
      const queueButton = screen.getByLabelText("Show queue");

      expect(footerActions.contains(queueButton)).toBe(true);
      expect(footerActions.contains(playButton)).toBe(false);
    });
  });

  describe("Accessibility", () => {
    it("has proper aria-labels for all action buttons", () => {
      render(<MobilePlayer {...defaultProps} />);

      expect(screen.getByLabelText("Show queue")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Sign in to add to playlists"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Sign in to favorite tracks"),
      ).toBeInTheDocument();
    });

    it("updates aria-labels based on authentication state", () => {
      const { rerender } = render(<MobilePlayer {...defaultProps} />);

      expect(
        screen.getByLabelText("Sign in to add to playlists"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Sign in to favorite tracks"),
      ).toBeInTheDocument();

      sessionState.data = mockSession;
      apiState.playlists = mockPlaylists;
      rerender(<MobilePlayer {...defaultProps} />);

      expect(screen.getByLabelText("Add to playlist")).toBeInTheDocument();
      expect(screen.getByLabelText("Add to favorites")).toBeInTheDocument();
    });

    it("updates favorite button aria-label based on favorite state", () => {
      sessionState.data = mockSession;
      apiState.favoriteData = { isFavorite: false };

      const { rerender } = render(<MobilePlayer {...defaultProps} />);
      expect(screen.getByLabelText("Add to favorites")).toBeInTheDocument();

      apiState.favoriteData = { isFavorite: true };
      rerender(<MobilePlayer {...defaultProps} />);
      expect(
        screen.getByLabelText("Remove from favorites"),
      ).toBeInTheDocument();
    });
  });
});
