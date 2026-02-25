// File: apps/web/src/global.d.ts

declare module "*.css";
declare module "eslint-plugin-drizzle";

declare global {
  namespace NodeJS {
    interface Process {
      resourcesPath?: string;
    }
  }
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  send?: (channel: string, data: unknown) => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
  onMediaKey: (callback: (key: string) => void) => void;
  removeMediaKeyListener: () => void;
  isElectron: boolean;
  platform: string;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }

  interface WindowControlsOverlay {
    getTitlebarAreaRect: () => DOMRect;
    visible: boolean;
    addEventListener: (
      type: "geometrychange",
      listener: () => void,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    removeEventListener: (
      type: "geometrychange",
      listener: () => void,
      options?: boolean | EventListenerOptions,
    ) => void;
  }

  interface Navigator {
    windowControlsOverlay?: WindowControlsOverlay;
  }
}

export {};
