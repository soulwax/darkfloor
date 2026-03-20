// File: apps/web/src/__tests__/music-import-client.test.ts

import { importSpotifyPlaylist } from "@starchild/api-client/trpc/music-import";
import type { ImportSpotifyPlaylistError } from "@starchild/api-client/trpc/music-import";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("importSpotifyPlaylist client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits to the Spotify import backend endpoint and preserves string playlist ids", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          playlist: {
            id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            name: "Imported playlist",
          },
          importReport: {
            sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
            sourcePlaylistName: "Today’s Top Hits",
            totalTracks: 4,
            matchedCount: 3,
            unmatchedCount: 1,
            skippedCount: 0,
            unmatched: [
              {
                index: 2,
                spotifyTrackId: "spotify-track-2",
                name: "Missing track",
                artist: "Unknown Artist",
                reason: "ambiguous",
                candidates: [
                  {
                    deezerTrackId: "601",
                    title: "Midnight City",
                    artist: "M83",
                    album: "Hurry Up, We Are Dreaming",
                    durationSeconds: 241,
                    score: 92,
                    link: "https://www.deezer.com/track/601",
                    coverImageUrl: "https://cdn.test/601.jpg",
                  },
                ],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await importSpotifyPlaylist({
      spotifyPlaylistId:
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      nameOverride: "Imported playlist",
      isPublic: true,
      sourcePlaylist: {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        name: "Today’s Top Hits",
        description: "Frontend snapshot",
        ownerName: "spotify",
        trackCount: 1,
        tracks: [
          {
            index: 0,
            spotifyTrackId: "spotify-track-1",
            name: "Track One",
            artist: "Artist One",
            artists: ["Artist One"],
            albumName: "Album One",
            durationMs: 180000,
            externalUrl: "https://open.spotify.com/track/spotify-track-1",
          },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/music/playlists/import/spotify",
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spotifyPlaylistId:
            "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
          nameOverride: "Imported playlist",
          descriptionOverride: undefined,
          isPublic: true,
          sourcePlaylist: {
            id: "37i9dQZF1DXcBWIGoYBM5M",
            name: "Today’s Top Hits",
            description: "Frontend snapshot",
            ownerName: "spotify",
            trackCount: 1,
            tracks: [
              {
                index: 0,
                spotifyTrackId: "spotify-track-1",
                name: "Track One",
                artist: "Artist One",
                artists: ["Artist One"],
                albumName: "Album One",
                durationMs: 180000,
                externalUrl: "https://open.spotify.com/track/spotify-track-1",
              },
            ],
          },
        }),
      },
    );
    expect(result.playlist.id).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(typeof result.playlist.id).toBe("string");
    expect(result.importReport.unmatched[0]?.index).toBe(2);
    expect(result.importReport.unmatched[0]?.candidates?.[0]?.title).toBe(
      "Midnight City",
    );
  });

  it("throws a status-aware error when Spotify setup is incomplete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Spotify profile incomplete",
        }),
        {
          status: 412,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(
      importSpotifyPlaylist({
        spotifyPlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
      }),
    ).rejects.toMatchObject({
      name: "ImportSpotifyPlaylistError",
      status: 412,
      message: "Spotify profile incomplete",
    } satisfies Partial<ImportSpotifyPlaylistError>);
  });

  it("normalizes nested source playlist fields before sending them", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          playlist: {
            id: "playlist-1",
            name: "Imported playlist",
          },
          importReport: {
            sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
            sourcePlaylistName: "Today’s Top Hits",
            totalTracks: 1,
            matchedCount: 1,
            unmatchedCount: 0,
            skippedCount: 0,
            unmatched: [],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await importSpotifyPlaylist({
      spotifyPlaylistId: " 37i9dQZF1DXcBWIGoYBM5M ",
      sourcePlaylist: {
        id: " 37i9dQZF1DXcBWIGoYBM5M ",
        name: " Today’s Top Hits ",
        description: " Frontend snapshot ",
        ownerName: " spotify ",
        trackCount: 1,
        tracks: [
          {
            index: 0,
            spotifyTrackId: " spotify-track-1 ",
            name: " Track One ",
            artist: " Artist One ",
            artists: [" Artist One ", " Artist Two "],
            albumName: " Album One ",
            durationMs: 180000,
            externalUrl: " https://open.spotify.com/track/spotify-track-1 ",
          },
        ],
      },
    });

    const fetchCall = fetchMock.mock.calls[0];
    const options = fetchCall?.[1];
    expect(options).toBeDefined();
    const body =
      options && typeof options === "object" && "body" in options
        ? JSON.parse(String(options.body))
        : null;

    expect(body).toEqual({
      spotifyPlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
      sourcePlaylist: {
        id: "37i9dQZF1DXcBWIGoYBM5M",
        name: "Today’s Top Hits",
        description: "Frontend snapshot",
        ownerName: "spotify",
        trackCount: 1,
        tracks: [
          {
            index: 0,
            spotifyTrackId: "spotify-track-1",
            name: "Track One",
            artist: "Artist One",
            artists: ["Artist One", "Artist Two"],
            albumName: "Album One",
            durationMs: 180000,
            externalUrl: "https://open.spotify.com/track/spotify-track-1",
          },
        ],
      },
    });
  });

  it("uses a caller-provided fetch implementation when one is supplied", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          playlist: {
            id: "playlist-1",
            name: "Imported playlist",
          },
          importReport: {
            sourcePlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
            sourcePlaylistName: "Today’s Top Hits",
            totalTracks: 1,
            matchedCount: 1,
            unmatchedCount: 0,
            skippedCount: 0,
            unmatched: [],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await importSpotifyPlaylist(
      {
        spotifyPlaylistId: "37i9dQZF1DXcBWIGoYBM5M",
      },
      {
        fetchImpl,
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/music/playlists/import/spotify",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
