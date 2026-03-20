// File: apps/web/src/utils/visualizerPreference.ts

import { STORAGE_KEYS } from "@starchild/config/storage";

export const VISUALIZER_PREFERENCE_UPDATED_EVENT =
  "starchild:visualizer-preference-updated";

const parseStoredBoolean = (raw: string): boolean | null => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === true) return true;
    if (parsed === false) return false;
    return null;
  } catch {
    return null;
  }
};

export const isFirefoxBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("firefox") && !userAgent.includes("seamonkey");
};

export const readStoredVisualizerEnabled = (): boolean | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEYS.VISUALIZER_ENABLED);
  if (stored === null) return null;
  return parseStoredBoolean(stored);
};

export const persistVisualizerEnabledPreference = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEYS.VISUALIZER_ENABLED,
    JSON.stringify(enabled),
  );
  window.dispatchEvent(
    new CustomEvent(VISUALIZER_PREFERENCE_UPDATED_EVENT, {
      detail: { enabled },
    }),
  );
};

export const getInitialVisualizerEnabledPreference = (): boolean => {
  const storedPreference = readStoredVisualizerEnabled();
  if (storedPreference !== null) return storedPreference;

  if (isFirefoxBrowser()) {
    persistVisualizerEnabledPreference(false);
    return false;
  }

  return true;
};
