// File: packages/types/src/settings.ts

export interface UserSettings {
  volume: number;
  repeatMode: "none" | "one" | "all";
  shuffleEnabled: boolean;
  keepPlaybackAlive: boolean;
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

export type StreamQuality = "low" | "normal" | "high";

export const DEFAULT_SETTINGS: UserSettings = {
  volume: 0.7,
  repeatMode: "none",
  shuffleEnabled: false,
  keepPlaybackAlive: true,
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
