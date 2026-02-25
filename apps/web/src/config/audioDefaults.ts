// File: apps/web/src/config/audioDefaults.ts

type DefaultEqualizerConfig = {
  preset: string;
  bands: number[];
  enabled: boolean;
};

export const DEFAULT_EQUALIZER: DefaultEqualizerConfig = {
  preset: "Flat",
  bands: Array.from({ length: 10 }, () => 0),
  enabled: false,
};
