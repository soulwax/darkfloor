// File: packages/player-react/src/storageService.ts

import type { StorageKey } from "@starchild/config/storage";

type StorageResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function isStorageAvailable(type: "localStorage" | "sessionStorage"): boolean {
  if (typeof window === "undefined") return false;

  try {
    const storage = window[type];
    const testKey = "__storage_test__";
    storage.setItem(testKey, "test");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

class StorageService {
  private storage: Storage | null = null;
  private readonly storageType: "localStorage" | "sessionStorage";

  constructor(storageType: "localStorage" | "sessionStorage" = "localStorage") {
    this.storageType = storageType;

    if (typeof window !== "undefined" && isStorageAvailable(storageType)) {
      this.storage = window[storageType];
    }
  }

  get<T>(key: StorageKey): StorageResult<T | null> {
    if (!this.storage) {
      return {
        success: false,
        error: `${this.storageType} is not available`,
      };
    }

    try {
      const item = this.storage.getItem(key);
      if (item === null) {
        return { success: true, data: null };
      }

      const parsed = JSON.parse(item) as T;
      return { success: true, data: parsed };
    } catch (error) {
      console.error(`Error reading from ${this.storageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getOrDefault<T>(key: StorageKey, defaultValue: T): T {
    const result = this.get<T>(key);
    if (result.success && result.data !== null) {
      return result.data;
    }
    return defaultValue;
  }

  set<T>(key: StorageKey, value: T): StorageResult<void> {
    if (!this.storage) {
      return {
        success: false,
        error: `${this.storageType} is not available`,
      };
    }

    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(key, serialized);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`Error writing to ${this.storageType}:`, error);

      if (
        error instanceof DOMException &&
        (error.code === 22 ||
          error.code === 1014 ||
          error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        try {
          this.storage.removeItem("queue_history");
          const serialized = JSON.stringify(value);
          this.storage.setItem(key, serialized);
          return { success: true, data: undefined };
        } catch {
          return {
            success: false,
            error: `${this.storageType} quota exceeded. Please clear browser data.`,
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  remove(key: StorageKey): StorageResult<void> {
    if (!this.storage) {
      return {
        success: false,
        error: `${this.storageType} is not available`,
      };
    }

    try {
      this.storage.removeItem(key);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`Error removing from ${this.storageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const localStorage = new StorageService("localStorage");
export const sessionStorage = new StorageService("sessionStorage");

export { StorageService };
