// File: apps/web/src/__tests__/player.integration.stability.test.ts

import { useAudioPlayer } from "@starchild/player-react/useAudioPlayer";
import type { Track } from "@starchild/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@starchild/api-client/rest", () => ({
  getStreamUrlById: vi.fn().mockResolvedValue("https://example.com/stream.mp3"),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const createMockTrack = (id: number): Track => ({
  id,
  title: `Track ${id}`,
  title_short: `Track ${id}`,
  link: `https://example.com/track/${id}`,
  readable: true,
  rank: 0,
  explicit_lyrics: false,
  explicit_content_lyrics: 0,
  explicit_content_cover: 0,
  type: "track",
  md5_image: "",
  artist: { id, name: `Artist ${id}`, type: "artist" },
  album: {
    id,
    title: `Album ${id}`,
    cover: "",
    cover_small: "",
    cover_medium: "",
    cover_big: "",
    cover_xl: "",
    md5_image: "",
    tracklist: "",
    type: "album",
  },
  duration: 180 + id * 10,
  preview: `https://example.com/preview${id}.mp3`,
});

describe("Player Integration Stability Tests", () => {
  let mockAudioElement:
    | (HTMLAudioElement & { preservesPitch?: boolean })
    | null;
  let eventListeners: Record<string, ((event: Event) => void)[]>;
  let playPromise: Promise<void>;
  let playResolve: () => void;
  let playMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventListeners = {};

    playPromise = new Promise((resolve) => {
      playResolve = resolve;
    });

    const element = document.createElement("audio") as HTMLAudioElement & {
      preservesPitch?: boolean;
    };

    playMock = vi.fn().mockReturnValue(playPromise);
    element.play = playMock;
    element.pause = vi.fn();
    element.load = vi.fn();

    Object.defineProperty(element, "paused", {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "currentTime", {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "duration", {
      value: 180,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "volume", {
      value: 0.7,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "muted", {
      value: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "readyState", {
      value: 4,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "src", {
      value: "",
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "playbackRate", {
      value: 1,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(element, "defaultPlaybackRate", {
      value: 1,
      writable: true,
      configurable: true,
    });
    element.style.display = "none";
    element.preservesPitch = true;

    mockAudioElement = element;

    element.addEventListener = vi.fn(
      (event: string, handler: (e: Event) => void) => {
        eventListeners[event] ??= [];
        eventListeners[event].push(handler);
      },
    ) as unknown as typeof element.addEventListener;

    element.removeEventListener = vi.fn(
      (event: string, handler: (e: Event) => void) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter(
            (h) => h !== handler,
          );
        }
      },
    ) as unknown as typeof element.removeEventListener;

    global.Audio = vi
      .fn()
      .mockImplementation(() => mockAudioElement as HTMLAudioElement);

    Object.defineProperty(global.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: {
            postMessage: vi.fn(),
          },
        } as unknown as ServiceWorkerRegistration),
      } as unknown as ServiceWorkerContainer,
    });

    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  const simulateTrackEnd = () => {
    const endedHandlers = eventListeners.ended ?? [];
    const event = new Event("ended");
    endedHandlers.forEach((handler) => handler(event));
  };

  const simulateTimeUpdate = (time: number) => {
    if (mockAudioElement) {
      mockAudioElement.currentTime = time;
    }
    const timeUpdateHandlers = eventListeners.timeupdate ?? [];
    const event = new Event("timeupdate");
    timeUpdateHandlers.forEach((handler) => handler(event));
  };

  describe("Complete User Flow: Listen to Multiple Tracks", () => {
    it("should play 3 tracks in sequence without player disappearing", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = [
        createMockTrack(1),
        createMockTrack(2),
        createMockTrack(3),
      ];

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      expect(result.current.queue).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        expect(result.current.currentTrack?.id).toBe(tracks[i]?.id);

        act(() => {
          void result.current.play();
        });

        await act(async () => {
          playResolve();
          await playPromise;
        });

        expect(result.current.isPlaying).toBe(true);

        act(() => {
          simulateTimeUpdate(mockAudioElement?.duration ?? 180);
        });

        act(() => {
          simulateTrackEnd();
        });

        await waitFor(() => {
          if (i < 2) {
            expect(result.current.currentTrack?.id).toBe(tracks[i + 1]?.id);
          }
        });

        expect(result.current.audioRef.current).not.toBeNull();
      }
    });

    it("should handle user switching tracks rapidly", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = Array.from({ length: 10 }, (_, i) =>
        createMockTrack(i + 1),
      );

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.playNext();
        });

        await waitFor(() => {
          expect(result.current.currentTrack).toBeDefined();
        });

        expect(result.current.audioRef.current).not.toBeNull();
      }

      expect(result.current.queue.length).toBeGreaterThan(0);
      expect(result.current.audioRef.current).not.toBeNull();
    });
  });

  describe("Repeat Mode Stability", () => {
    it("should handle repeat-one mode without errors", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const track = createMockTrack(1);

      act(() => {
        result.current.addToQueue(track);
        (
          result.current as typeof result.current & {
            setRepeatMode: (mode: "off" | "one" | "all") => void;
          }
        ).setRepeatMode("one");
      });

      act(() => {
        void result.current.play();
      });

      await act(async () => {
        playResolve();
        await playPromise;
      });

      expect(result.current.isPlaying).toBe(true);

      for (let i = 0; i < 3; i++) {
        act(() => {
          simulateTrackEnd();
        });

        await waitFor(() => {
          expect(playMock).toHaveBeenCalled();
        });

        expect(result.current.currentTrack?.id).toBe(track.id);
        expect(result.current.audioRef.current).not.toBeNull();
      }
    });

    it("should handle repeat-all mode with queue rotation", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = [createMockTrack(1), createMockTrack(2)];

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
        (
          result.current as typeof result.current & {
            setRepeatMode: (mode: "off" | "one" | "all") => void;
          }
        ).setRepeatMode("all");
      });

      for (let i = 0; i < 5; i++) {
        act(() => {
          simulateTrackEnd();
        });

        await waitFor(() => {
          expect(result.current.currentTrack).toBeDefined();
        });

        expect(result.current.audioRef.current).not.toBeNull();
        expect(result.current.queue.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Background Playback Simulation", () => {
    it("should maintain playback when page goes to background", async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useAudioPlayer({ keepPlaybackAlive: true }),
      );

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(1));
      });

      act(() => {
        void result.current.play();
      });

      await act(async () => {
        playResolve();
        await playPromise;
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          value: "hidden",
        });
        const event = new Event("visibilitychange");
        document.dispatchEvent(event);
      });

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(result.current.audioRef.current).not.toBeNull();
      expect(result.current.currentTrack).toBeDefined();

      vi.useRealTimers();
    });

    it("should resume playback when returning to foreground", async () => {
      const { result } = renderHook(() =>
        useAudioPlayer({ keepPlaybackAlive: true }),
      );

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(1));
      });

      act(() => {
        void result.current.play();
      });

      await act(async () => {
        playResolve();
        await playPromise;
      });

      act(() => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      act(() => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(result.current.audioRef.current).not.toBeNull();
    });
  });

  describe("Error Recovery", () => {
    it("should recover from stream URL fetch failure", async () => {
      const { getStreamUrlById } = await import("@starchild/api-client/rest");
      const onError = vi.fn();

      (getStreamUrlById as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("https://example.com/stream.mp3");

      const { result } = renderHook(() => useAudioPlayer({ onError }));

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(1));
      });

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(2));
        result.current.playNext();
      });

      expect(result.current.audioRef.current).not.toBeNull();
    });

    it("should handle playback errors without crashing", async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useAudioPlayer({ onError }));

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(1));
      });

      if (mockAudioElement?.play) {
        (mockAudioElement.play as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Playback not allowed"),
        );
      }

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.audioRef.current).not.toBeNull();
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("Queue Management Stability", () => {
    it("should handle adding/removing tracks while playing", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createMockTrack(1));
        result.current.addToQueue(createMockTrack(2));
      });

      act(() => {
        void result.current.play();
      });

      await act(async () => {
        playResolve();
        await playPromise;
      });

      act(() => {
        result.current.addToQueue(createMockTrack(3));
      });

      expect(result.current.queue).toHaveLength(3);

      act(() => {
        result.current.removeFromQueue(2);
      });

      expect(result.current.queue).toHaveLength(2);
      expect(result.current.audioRef.current).not.toBeNull();
      expect(result.current.isPlaying).toBe(true);
    });

    it("should handle clearing queue gracefully", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = Array.from({ length: 5 }, (_, i) =>
        createMockTrack(i + 1),
      );

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      act(() => {
        void result.current.play();
      });

      await act(async () => {
        playResolve();
        await playPromise;
      });

      act(() => {
        result.current.clearQueue();
      });

      expect(result.current.queue).toHaveLength(0);
      expect(result.current.audioRef.current).not.toBeNull();
    });
  });

  describe("Shuffle Mode Stability", () => {
    it("should maintain queue integrity when toggling shuffle", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = Array.from({ length: 5 }, (_, i) =>
        createMockTrack(i + 1),
      );

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      const originalQueue = [...result.current.queue];
      const originalQueueLength = originalQueue.length;

      act(() => {
        result.current.toggleShuffle();
      });

      expect(result.current.queue).toHaveLength(originalQueueLength);
      expect(result.current.audioRef.current).not.toBeNull();

      act(() => {
        result.current.toggleShuffle();
      });

      expect(result.current.queue).toHaveLength(originalQueueLength);
      expect(result.current.queue.map((track) => track.id)).toEqual(
        originalQueue.map((track) => track.id),
      );
    });

    it("should not duplicate tracks when shuffle is toggled rapidly", async () => {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = Array.from({ length: 6 }, (_, i) =>
        createMockTrack(i + 1),
      );

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      const originalIds = result.current.queue.map((track) => track.id);

      act(() => {
        for (let i = 0; i < 7; i += 1) {
          result.current.toggleShuffle();
        }
      });

      expect(result.current.queue).toHaveLength(originalIds.length);
      expect(new Set(result.current.queue.map((track) => track.id)).size).toBe(
        originalIds.length,
      );

      act(() => {
        result.current.toggleShuffle();
      });

      expect(result.current.queue.map((track) => track.id)).toEqual(originalIds);
    });
  });

  describe("Long Session Stability", () => {
    it("should handle extended playback session without memory leaks", async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      const { result } = renderHook(() =>
        useAudioPlayer({ keepPlaybackAlive: true }),
      );

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      const tracks = Array.from({ length: 20 }, (_, i) =>
        createMockTrack(i + 1),
      );

      act(() => {
        tracks.forEach((track) => result.current.addToQueue(track));
      });

      const initialIntervalCount = setIntervalSpy.mock.calls.length;

      for (let i = 0; i < 10; i++) {
        act(() => {
          void result.current.play();
        });

        await act(async () => {
          playResolve();
          await playPromise;
        });

        act(() => {
          vi.advanceTimersByTime(10000);
        });

        act(() => {
          simulateTrackEnd();
        });

        await waitFor(() => {
          expect(result.current.audioRef.current).not.toBeNull();
        });
      }

      const finalIntervalCount = setIntervalSpy.mock.calls.length;
      const intervalGrowth = finalIntervalCount - initialIntervalCount;

      expect(intervalGrowth).toBeLessThan(20);

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });
});
