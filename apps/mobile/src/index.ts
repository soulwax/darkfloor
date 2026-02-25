// File: apps/mobile/src/index.ts

import { STORAGE_KEYS } from "@starchild/config/storage";
import { VISUALIZER_TYPES } from "@starchild/config/visualizer";
import type { RepeatMode } from "@starchild/player-core";
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
  supportedVisualizerTypes: VISUALIZER_TYPES,
} as const;

export function createInitialMobileShellState(): MobileShellState {
  return {
    queueLength: 0,
    repeatMode: "none",
    currentTrack: null,
  };
}
