// File: apps/web/src/__tests__/useAudioPlayer.test.ts

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { useAudioPlayer } from "@starchild/player-react/useAudioPlayer";
import type { Track } from "@starchild/types";

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

describe("useAudioPlayer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("creates and attaches the global audio element", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await waitFor(() => {
      expect(result.current.audioRef.current).not.toBeNull();
      expect(result.current.audioElement).not.toBeNull();
    });

    const audioEl = document.querySelector(
      'audio[data-audio-element="global-player"]',
    );

    expect(audioEl).toBeInTheDocument();
    expect(audioEl?.getAttribute("playsinline")).toBe("true");
    expect(audioEl?.getAttribute("webkit-playsinline")).toBe("true");
    expect(audioEl?.getAttribute("x5-playsinline")).toBe("true");
  });

  it("keeps media session play and pause actions idempotent", async () => {
    const actionHandlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler | null>
    > = {};
    const originalMediaMetadata = globalThis.MediaMetadata;

    Object.defineProperty(globalThis, "MediaMetadata", {
      configurable: true,
      writable: true,
      value: vi.fn(function MediaMetadata(metadata?: MediaMetadataInit) {
        return metadata;
      }),
    });
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: {
        metadata: null,
        playbackState: "none",
        setActionHandler: vi.fn(
          (
            action: MediaSessionAction,
            handler: MediaSessionActionHandler | null,
          ) => {
            actionHandlers[action] = handler;
          },
        ),
      },
    });

    try {
      const { result } = renderHook(() => useAudioPlayer());

      await waitFor(() => {
        expect(result.current.audioRef.current).not.toBeNull();
      });

      act(() => {
        result.current.addToQueue(createTrack(30, "Media Session Track"));
      });

      await waitFor(() => {
        expect(actionHandlers.play).toEqual(expect.any(Function));
        expect(actionHandlers.pause).toEqual(expect.any(Function));
      });

      const audio = result.current.audioRef.current!;
      const playSpy = vi.spyOn(audio, "play");
      const pauseSpy = vi.spyOn(audio, "pause");

      Object.defineProperty(audio, "paused", {
        configurable: true,
        value: false,
      });

      act(() => {
        actionHandlers.play?.({ action: "play" });
      });

      expect(pauseSpy).not.toHaveBeenCalled();
      expect(playSpy).not.toHaveBeenCalled();

      Object.defineProperty(audio, "paused", {
        configurable: true,
        value: true,
      });

      act(() => {
        actionHandlers.pause?.({ action: "pause" });
      });

      expect(playSpy).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "mediaSession");
      if (originalMediaMetadata) {
        Object.defineProperty(globalThis, "MediaMetadata", {
          configurable: true,
          writable: true,
          value: originalMediaMetadata,
        });
      } else {
        Reflect.deleteProperty(globalThis, "MediaMetadata");
      }
    }
  });

  it("advances to the next track when playback ends", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await waitFor(() => {
      expect(result.current.audioRef.current).not.toBeNull();
    });

    const first = createTrack(1, "First Track");
    const second = createTrack(2, "Second Track");

    act(() => {
      result.current.addToQueue([first, second]);
    });

    await waitFor(() => {
      expect(result.current.queue).toHaveLength(2);
    });

    const audio = result.current.audioRef.current!;
    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });

    await waitFor(() => {
      expect(result.current.queue[0]?.id).toBe(second.id);
      expect(result.current.history[0]?.id).toBe(first.id);
    });
  });

  it("advances to the next track when playNext is called", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await waitFor(() => {
      expect(result.current.audioRef.current).not.toBeNull();
    });

    const first = createTrack(10, "First Up");
    const second = createTrack(11, "Next Up");

    act(() => {
      result.current.addToQueue([first, second]);
    });

    await waitFor(() => {
      expect(result.current.queue).toHaveLength(2);
    });

    act(() => {
      result.current.playNext();
    });

    await waitFor(() => {
      expect(result.current.queue[0]?.id).toBe(second.id);
      expect(result.current.history[0]?.id).toBe(first.id);
    });
  });

  it("restores the persisted playback position for the current track", async () => {
    const track = createTrack(77, "Resume Me");

    localStorage.setItem(
      STORAGE_KEYS.QUEUE_STATE,
      JSON.stringify({
        version: 2,
        queuedTracks: [
          {
            track,
            queueSource: "user",
            addedAt: new Date("2026-04-21T00:00:00.000Z").toISOString(),
            queueId: "queue-resume-77",
          },
        ],
        smartQueueState: {
          isActive: false,
          lastRefreshedAt: null,
          seedTrackId: null,
          trackCount: 0,
        },
        history: [],
        currentTime: 47,
        isShuffled: false,
        repeatMode: "none",
      }),
    );

    const { result } = renderHook(() => useAudioPlayer());

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe(track.id);
      expect(result.current.audioRef.current).not.toBeNull();
    });

    const audio = result.current.audioRef.current!;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      writable: true,
      value: 180,
    });

    act(() => {
      audio.dispatchEvent(new Event("loadedmetadata"));
    });

    await waitFor(() => {
      expect(audio.currentTime).toBe(47);
      expect(result.current.currentTime).toBe(47);
    });
  });
});
