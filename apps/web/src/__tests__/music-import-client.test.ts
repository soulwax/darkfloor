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
                reason: "not_found",
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
        }),
      },
    );
    expect(result.playlist.id).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(typeof result.playlist.id).toBe("string");
    expect(result.importReport.unmatched[0]?.index).toBe(2);
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
