import { STORAGE_KEYS } from "@starchild/config/storage";
import type { RepeatMode, Track } from "@starchild/player-core";
import { isTrack } from "@starchild/types";

import type { MobileShellState, MobileTabId } from "./types";

interface StoredMobileShellState {
  activeTab: MobileTabId;
  currentTrack: Track | null;
  queueLength: number;
  repeatMode: RepeatMode;
  searchQuery: string;
  restoredAt: string;
}

const MOBILE_TAB_IDS: readonly MobileTabId[] = [
  "home",
  "discover",
  "library",
  "search",
] as const;
const REPEAT_MODES: readonly RepeatMode[] = ["none", "one", "all"] as const;

function canUseLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isMobileTabId(value: unknown): value is MobileTabId {
  return typeof value === "string" && MOBILE_TAB_IDS.includes(value as MobileTabId);
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return typeof value === "string" && REPEAT_MODES.includes(value as RepeatMode);
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isStoredMobileShellState(
  value: unknown,
): value is StoredMobileShellState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredMobileShellState>;

  return (
    isMobileTabId(candidate.activeTab) &&
    (candidate.currentTrack === null || isTrack(candidate.currentTrack)) &&
    typeof candidate.queueLength === "number" &&
    Number.isFinite(candidate.queueLength) &&
    candidate.queueLength >= 0 &&
    isRepeatMode(candidate.repeatMode) &&
    typeof candidate.searchQuery === "string" &&
    isIsoDateString(candidate.restoredAt)
  );
}

export function restoreMobileShellState(
  fallbackState: MobileShellState,
): MobileShellState {
  if (!canUseLocalStorage()) {
    return fallbackState;
  }

  try {
    const rawValue = globalThis.localStorage.getItem(
      STORAGE_KEYS.MOBILE_SHELL_STATE,
    );

    if (!rawValue) {
      return fallbackState;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isStoredMobileShellState(parsedValue)) {
      return fallbackState;
    }

    return {
      ...fallbackState,
      activeTab: parsedValue.activeTab,
      currentTrack: parsedValue.currentTrack,
      queueLength: parsedValue.queueLength,
      repeatMode: parsedValue.repeatMode,
      searchQuery: parsedValue.searchQuery,
      hydrationSource: "restored",
      restoredAt: parsedValue.restoredAt,
    };
  } catch {
    return fallbackState;
  }
}

export function persistMobileShellState(state: MobileShellState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const payload: StoredMobileShellState = {
    activeTab: state.activeTab,
    currentTrack: state.currentTrack,
    queueLength: state.queueLength,
    repeatMode: state.repeatMode,
    searchQuery: state.searchQuery,
    restoredAt: new Date().toISOString(),
  };

  try {
    globalThis.localStorage.setItem(
      STORAGE_KEYS.MOBILE_SHELL_STATE,
      JSON.stringify(payload),
    );
  } catch {
    // Ignore storage quota and privacy-mode errors; the shell still runs.
  }
}
