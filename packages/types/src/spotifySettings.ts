// File: packages/types/src/spotifySettings.ts

export interface SpotifyFeatureSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  username: string;
  updatedAt: string | null;
}

export type SpotifyFeatureConnectionState =
  | "disabled"
  | "incomplete"
  | "ready"
  | "unavailable";

export const DEFAULT_SPOTIFY_FEATURE_SETTINGS: SpotifyFeatureSettings = {
  enabled: false,
  clientId: "",
  clientSecret: "",
  username: "",
  updatedAt: null,
};
