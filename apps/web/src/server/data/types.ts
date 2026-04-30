import type { Track } from "@starchild/types";

import type {
  playlistTracks,
  playlists,
  users,
  userPreferences,
} from "@/server/db/schema";

export type PlaylistRecord = typeof playlists.$inferSelect;
export type PlaylistInsert = typeof playlists.$inferInsert;
export type PlaylistTrackRecord = typeof playlistTracks.$inferSelect;
export type PlaylistOwnerRecord = Pick<
  typeof users.$inferSelect,
  "id" | "name" | "image" | "userHash"
>;
export type UserPreferencesRecord = typeof userPreferences.$inferSelect;
export type UserPreferencesInsert = typeof userPreferences.$inferInsert;
export type QueueState = UserPreferencesRecord["queueState"];

export type PlaylistTrackView = {
  id: number;
  track: Track;
  position: number;
  addedAt: Date;
  addedByUserId: string | null;
  addedBy: PlaylistOwnerRecord | null;
};

export type PlaylistDetails = PlaylistRecord & {
  owner: PlaylistOwnerRecord | null;
  tracks: PlaylistTrackView[];
};

export type PlaylistSummary = PlaylistRecord & {
  trackCount: number;
  tracks: PlaylistTrackView[];
};

export type PlaylistWithTrackStatus = PlaylistRecord & {
  trackCount: number;
  hasTrack: boolean;
  tracks: PlaylistTrackView[];
};

export type UserPreferencesUiRecord = Pick<
  UserPreferencesRecord,
  | "id"
  | "userId"
  | "volume"
  | "repeatMode"
  | "shuffleEnabled"
  | "keepPlaybackAlive"
  | "streamQuality"
  | "equalizerEnabled"
  | "equalizerPreset"
  | "equalizerBands"
  | "equalizerPanelOpen"
  | "queuePanelOpen"
  | "visualizerType"
  | "visualizerEnabled"
  | "visualizerMode"
  | "compactMode"
  | "theme"
  | "colorScheme"
  | "language"
  | "spotifyFeaturesEnabled"
  | "spotifyClientId"
  | "spotifyClientSecret"
  | "spotifyUsername"
  | "spotifySettingsUpdatedAt"
  | "autoQueueEnabled"
  | "autoQueueThreshold"
  | "autoQueueCount"
  | "smartMixEnabled"
  | "similarityPreference"
  | "createdAt"
  | "updatedAt"
>;

export type EqualizerPreferences = {
  enabled: boolean;
  preset: string;
  bands: number[];
};

export type EqualizerPreferencesUpdate = {
  enabled?: boolean;
  preset?: string;
  bands?: number[];
};

export type PlaylistMetadataUpdate = {
  name?: string;
  description?: string;
};

export type PlaylistTrackPositionUpdate = {
  trackEntryId: number;
  newPosition: number;
};

export type AddTrackToPlaylistResult =
  | { status: "added" }
  | { status: "already-exists" }
  | { status: "playlist-not-found" };
