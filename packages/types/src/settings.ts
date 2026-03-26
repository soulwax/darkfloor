// File: packages/types/src/settings.ts

export interface UserSettings {
  volume: number;
  repeatMode: "none" | "one" | "all";
  shuffleEnabled: boolean;
  keepPlaybackAlive: boolean;
  streamQuality: StreamQuality;
  equalizerEnabled: boolean;
  equalizerPreset: string;
  visualizerMode: "random" | "off" | "specific";
  visualizerType: string;
  showFpsCounter: boolean;
  compactMode: boolean;
  theme: "light" | "dark";
  autoQueueEnabled: boolean;
  autoQueueThreshold: number;
  autoQueueCount: number;
  smartMixEnabled: boolean;
  similarityPreference: "strict" | "balanced" | "diverse";
}

export const STREAM_QUALITY_OPTIONS = [
  "128",
  "192",
  "256",
  "320",
  "flac",
] as const;
export type StreamQuality = (typeof STREAM_QUALITY_OPTIONS)[number];
export const DEFAULT_STREAM_QUALITY: StreamQuality = "256";
export const GUEST_STREAM_QUALITY: StreamQuality = "128";

export const DEFAULT_SETTINGS: UserSettings = {
  volume: 0.7,
  repeatMode: "none",
  shuffleEnabled: false,
  keepPlaybackAlive: true,
  streamQuality: DEFAULT_STREAM_QUALITY,
  equalizerEnabled: false,
  equalizerPreset: "Flat",
  visualizerMode: "random",
  visualizerType: "flowfield",
  showFpsCounter: false,
  compactMode: false,
  theme: "dark",
  autoQueueEnabled: false,
  autoQueueThreshold: 3,
  autoQueueCount: 5,
  smartMixEnabled: true,
  similarityPreference: "balanced",
};

export type SettingsKey = keyof UserSettings;
