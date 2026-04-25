// File: packages/types/src/settings.ts

export const COLOR_SCHEME_IDS = [
  "starchild",
  "tokyo-night",
  "dracula",
  "nord",
  "gruvbox",
  "catppuccin",
  "monokai",
  "solarized-dark",
  "one-dark",
  "rose-pine",
] as const;

export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number];
export const DEFAULT_COLOR_SCHEME: ColorSchemeId = "starchild";

export function isColorSchemeId(value: unknown): value is ColorSchemeId {
  return (
    typeof value === "string" &&
    (COLOR_SCHEME_IDS as readonly string[]).includes(value)
  );
}

export function normalizeColorSchemeId(value: unknown): ColorSchemeId {
  return isColorSchemeId(value) ? value : DEFAULT_COLOR_SCHEME;
}

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
  visualizerFidelity: VisualizerFidelity;
  showFpsCounter: boolean;
  compactMode: boolean;
  theme: "light" | "dark";
  colorScheme: ColorSchemeId;
  autoQueueEnabled: boolean;
  autoQueueThreshold: number;
  autoQueueCount: number;
  smartMixEnabled: boolean;
  similarityPreference: "strict" | "balanced" | "diverse";
}

export const VISUALIZER_FIDELITY_OPTIONS = [
  "performance",
  "balanced",
  "quality",
  "ultra",
] as const;

export type VisualizerFidelity = (typeof VISUALIZER_FIDELITY_OPTIONS)[number];

export const DEFAULT_VISUALIZER_FIDELITY: VisualizerFidelity = "balanced";

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
  visualizerFidelity: DEFAULT_VISUALIZER_FIDELITY,
  showFpsCounter: false,
  compactMode: false,
  theme: "dark",
  colorScheme: DEFAULT_COLOR_SCHEME,
  autoQueueEnabled: false,
  autoQueueThreshold: 3,
  autoQueueCount: 5,
  smartMixEnabled: true,
  similarityPreference: "balanced",
};

export type SettingsKey = keyof UserSettings;
