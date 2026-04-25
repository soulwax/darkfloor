// File: packages/visualizers/src/browser.ts

import {
  DEFAULT_VISUALIZER_FIDELITY,
  type VisualizerFidelity,
} from "@starchild/types/settings";

export const DEFAULT_VISUALIZER_RESOLUTION_SCALE = 0.5;
export const FIREFOX_VISUALIZER_RESOLUTION_SCALE = 0.5;
const VISUALIZER_FIDELITY_SCALE: Record<VisualizerFidelity, number> = {
  performance: 0.35,
  balanced: DEFAULT_VISUALIZER_RESOLUTION_SCALE,
  quality: 0.67,
  ultra: 1,
};

export const isFirefoxBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("firefox") && !userAgent.includes("seamonkey");
};

export const getVisualizerResolutionScale = (
  fidelity: VisualizerFidelity = DEFAULT_VISUALIZER_FIDELITY,
): number =>
  (VISUALIZER_FIDELITY_SCALE[fidelity] ?? DEFAULT_VISUALIZER_RESOLUTION_SCALE) *
  (isFirefoxBrowser() ? FIREFOX_VISUALIZER_RESOLUTION_SCALE : 1);
