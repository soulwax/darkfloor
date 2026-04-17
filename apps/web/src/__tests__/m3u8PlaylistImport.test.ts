import { describe, expect, it } from "vitest";

import type { Track } from "@starchild/types";
import {
  parseM3u8Playlist,
  selectBestM3u8TrackMatch,
} from "@/utils/m3u8PlaylistImport";

function makeTrack(input: {
  id: number;
  title: string;
  artist: string;
  rank?: number;
}): Track {
  return {
    id: input.id,
    readable: true,
    title: input.title,
    title_short: input.title,
    link: `https://www.deezer.com/track/${input.id}`,
    duration: 180,
    rank: input.rank ?? 0,
    explicit_lyrics: false,
    explicit_content_lyrics: 0,
    explicit_content_cover: 0,
    preview: "",
    md5_image: "",
    artist: {
      id: input.id + 1,
      name: input.artist,
      type: "artist",
    },
    album: {
      id: input.id + 2,
      title: "Test Album",
      cover: "",
      cover_small: "",
      cover_medium: "",
      cover_big: "",
      cover_xl: "",
      md5_image: "",
      tracklist: "",
      type: "album",
    },
    type: "track",
    deezer_id: input.id,
  };
}

describe("m3u8PlaylistImport", () => {
  it("parses EXTINF entries into searchable artist/title pairs", () => {
    const result = parseM3u8Playlist(
      [
        "#EXTM3U",
        "#EXTINF:213,Massive Attack - Teardrop",
        "https://cdn.example.test/audio/teardrop.mp3",
        "#EXTINF:-1,Burial - Archangel",
        "https://www.deezer.com/track/3135556",
      ].join("\n"),
      "late-night.m3u8",
    );

    expect(result.name).toBe("late-night");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      artist: "Massive Attack",
      title: "Teardrop",
      query: "Massive Attack Teardrop",
      durationSeconds: 213,
    });
    expect(result.entries[1]).toMatchObject({
      artist: "Burial",
      title: "Archangel",
      deezerTrackId: 3135556,
      durationSeconds: null,
    });
  });

  it("derives titles from file paths when metadata is absent", () => {
    const result = parseM3u8Playlist(
      "/music/Boards%20of%20Canada%20-%20Roygbiv.flac\n",
      "crate.m3u",
    );

    expect(result.name).toBe("crate");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      artist: "Boards of Canada",
      title: "Roygbiv",
      query: "Boards of Canada Roygbiv",
    });
  });

  it("prefers the best title and artist match from search results", () => {
    const [entry] = parseM3u8Playlist(
      "#EXTINF:0,Portishead - Roads\nroads.mp3",
    ).entries;

    expect(entry).toBeDefined();

    const selected = selectBestM3u8TrackMatch(entry!, [
      makeTrack({
        id: 1,
        title: "Roads",
        artist: "Someone Else",
        rank: 900_000,
      }),
      makeTrack({ id: 2, title: "Roads", artist: "Portishead", rank: 10 }),
    ]);

    expect(selected?.id).toBe(2);
  });

  it("rejects weak search matches", () => {
    const [entry] = parseM3u8Playlist(
      "#EXTINF:0,Autechre - Rae\nrae.mp3",
    ).entries;

    expect(entry).toBeDefined();

    const selected = selectBestM3u8TrackMatch(entry!, [
      makeTrack({ id: 3, title: "Completely Different", artist: "Other" }),
    ]);

    expect(selected).toBeNull();
  });
});
