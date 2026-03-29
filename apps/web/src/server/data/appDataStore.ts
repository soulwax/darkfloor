import type { Track } from "@starchild/types";

import type {
  AddTrackToPlaylistResult,
  EqualizerPreferences,
  EqualizerPreferencesUpdate,
  PlaylistDetails,
  PlaylistMetadataUpdate,
  PlaylistRecord,
  PlaylistSummary,
  PlaylistTrackPositionUpdate,
  PlaylistWithTrackStatus,
  QueueState,
  UserPreferencesInsert,
  UserPreferencesRecord,
  UserPreferencesUiRecord,
} from "@/server/data/types";

export interface PlaylistDataStore {
  createForUser(input: {
    userId: string;
    name: string;
    description?: string;
    isPublic: boolean;
  }): Promise<PlaylistRecord>;
  updateOwnedVisibility(input: {
    userId: string;
    playlistId: number;
    isPublic: boolean;
  }): Promise<boolean>;
  updateOwnedMetadata(input: {
    userId: string;
    playlistId: number;
    metadata: PlaylistMetadataUpdate;
  }): Promise<boolean>;
  listOwnedByUser(userId: string): Promise<PlaylistSummary[]>;
  listOwnedByUserWithTrackStatus(input: {
    userId: string;
    trackId: number;
    excludePlaylistId?: number;
  }): Promise<PlaylistWithTrackStatus[]>;
  getOwnedDetails(input: {
    userId: string;
    playlistId: number;
  }): Promise<PlaylistDetails | null>;
  getPublicDetails(playlistId: number): Promise<PlaylistDetails | null>;
  addTrackToOwnedPlaylist(input: {
    userId: string;
    playlistId: number;
    track: Track;
  }): Promise<AddTrackToPlaylistResult>;
  removeTrackFromOwnedPlaylist(input: {
    userId: string;
    playlistId: number;
    trackEntryId: number;
  }): Promise<boolean>;
  deleteOwnedPlaylist(input: {
    userId: string;
    playlistId: number;
  }): Promise<void>;
  reorderOwnedPlaylist(input: {
    userId: string;
    playlistId: number;
    trackUpdates: PlaylistTrackPositionUpdate[];
  }): Promise<boolean>;
}

export interface UserPreferencesDataStore {
  getByUserId(userId: string): Promise<UserPreferencesRecord | null>;
  getUiByUserId(userId: string): Promise<UserPreferencesUiRecord | null>;
  getOrCreateUiByUserId(userId: string): Promise<UserPreferencesUiRecord>;
  upsert(userId: string, values: Partial<UserPreferencesInsert>): Promise<void>;
  reset(userId: string): Promise<void>;
  getQueueState(userId: string): Promise<QueueState>;
  setQueueState(userId: string, queueState: QueueState): Promise<void>;
  clearQueueState(userId: string): Promise<void>;
  getEqualizerByUserId(userId: string): Promise<EqualizerPreferences | null>;
  upsertEqualizerByUserId(
    userId: string,
    values: EqualizerPreferencesUpdate,
  ): Promise<EqualizerPreferences>;
}

export interface AppDataStore {
  kind: string;
  playlists: PlaylistDataStore;
  userPreferences: UserPreferencesDataStore;
}
