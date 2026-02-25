// File: apps/web/src/utils/settingsStorage.ts

import {
  DEFAULT_SETTINGS,
  type SettingsKey,
  type UserSettings,
} from "@starchild/types/settings";

const SETTINGS_STORAGE_KEY = "starchild_user_settings";
export const SETTINGS_UPDATED_EVENT = "starchild:settings-updated";

export const settingsStorage = {
  get(): Partial<UserSettings> {
    if (typeof window === "undefined") return {};

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) return {};

      const parsed = JSON.parse(stored) as Partial<UserSettings>;
      return parsed;
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      return {};
    }
  },

  set(key: SettingsKey, value: string | number | boolean): void {
    if (typeof window === "undefined") return;

    try {
      const current = this.get();
      const updated = { ...current, [key]: value };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent(SETTINGS_UPDATED_EVENT, {
          detail: { key, value, settings: updated },
        }),
      );
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  },

  getAll(): UserSettings {
    const stored = this.get();
    return { ...DEFAULT_SETTINGS, ...stored };
  },

  clear(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear settings from localStorage:", error);
    }
  },

  getSetting<K extends SettingsKey>(
    key: K,
    defaultValue?: UserSettings[K],
  ): UserSettings[K] {
    const settings = this.getAll();
    const value = settings[key];
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    return DEFAULT_SETTINGS[key];
  },
};
