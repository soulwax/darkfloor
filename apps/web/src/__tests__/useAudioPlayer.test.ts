// File: apps/web/src/__tests__/useAudioPlayer.test.ts

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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
    });

    const audioEl = document.querySelector(
      'audio[data-audio-element="global-player"]',
    );

    expect(audioEl).toBeInTheDocument();
    expect(audioEl?.getAttribute("playsinline")).toBe("true");
    expect(audioEl?.getAttribute("webkit-playsinline")).toBe("true");
    expect(audioEl?.getAttribute("x5-playsinline")).toBe("true");
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
});
