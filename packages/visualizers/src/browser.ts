// File: packages/visualizers/src/browser.ts

export const FIREFOX_VISUALIZER_RESOLUTION_SCALE = 0.5;

export const isFirefoxBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("firefox") && !userAgent.includes("seamonkey");
};

export const getVisualizerResolutionScale = (): number =>
  isFirefoxBrowser() ? FIREFOX_VISUALIZER_RESOLUTION_SCALE : 1;
