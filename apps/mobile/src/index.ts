// File: apps/mobile/src/index.ts

import { STORAGE_KEYS } from "@starchild/config/storage";
import { VISUALIZER_TYPES } from "@starchild/config/visualizer";
import type { RepeatMode } from "@starchild/player-core";
import { DEFAULT_SPOTIFY_FEATURE_SETTINGS } from "@starchild/types/spotifySettings";
import type { Track } from "@starchild/types";

export interface MobileShellState {
  queueLength: number;
  repeatMode: RepeatMode;
  currentTrack: Track | null;
}

export const MOBILE_SHELL_INFO = {
  app: "@starchild/mobile",
  status: "scaffold",
  sharedStorageKeys: {
    volume: STORAGE_KEYS.VOLUME,
    queueState: STORAGE_KEYS.QUEUE_STATE,
  },
  spotifyFeatureDefaults: DEFAULT_SPOTIFY_FEATURE_SETTINGS,
  supportedVisualizerTypes: VISUALIZER_TYPES,
} as const;

export function createInitialMobileShellState(): MobileShellState {
  return {
    queueLength: 0,
    repeatMode: "none",
    currentTrack: null,
  };
}
