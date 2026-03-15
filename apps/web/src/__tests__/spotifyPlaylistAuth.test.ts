import {
  getSpotifyConnectedAccountLabel,
  resolveSpotifyPlaylistAuthCapability,
} from "@/utils/spotifyPlaylistAuth";
import { describe, expect, it } from "vitest";

describe("spotifyPlaylistAuth", () => {
  it("treats missing bearer auth as a blocked import state", () => {
    const capability = resolveSpotifyPlaylistAuthCapability({
      status: 401,
      errorMessage: "No auth token",
    });

    expect(capability.state).toBe("missing");
    expect(capability.summary).toBeNull();
  });

  it("marks basic-profile Spotify sessions as profile-only", () => {
    const capability = resolveSpotifyPlaylistAuthCapability({
      payload: {
        profile: {
          display_name: "Soulwax",
          email: "soulwax@example.com",
          id: "spotify-user-1",
        },
        scope: "user-read-email user-read-private",
      },
      status: 200,
    });

    expect(capability.state).toBe("profile_only");
    expect(getSpotifyConnectedAccountLabel(capability.summary)).toBe("Soulwax");
  });

  it("allows imports when playlist-capable Spotify scopes are present", () => {
    const capability = resolveSpotifyPlaylistAuthCapability({
      payload: {
        profile: {
          display_name: "Soulwax",
          email: "soulwax@example.com",
          id: "spotify-user-1",
        },
        scope:
          "user-read-email user-read-private playlist-read-private playlist-read-collaborative",
      },
      status: 200,
    });

    expect(capability.state).toBe("connected");
    expect(capability.summary?.hasPlaylistReadScope).toBe(true);
  });
});
