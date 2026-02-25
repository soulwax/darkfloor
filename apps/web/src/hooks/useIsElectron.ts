// File: apps/web/src/hooks/useIsElectron.ts

"use client";

export function useIsElectron(): boolean {
  if (typeof globalThis === "undefined") return false;

  const globalScope = globalThis as typeof globalThis & {
    electron?: { isElectron?: boolean };
    navigator?: Navigator;
  };

  if (globalScope.electron?.isElectron) return true;

  const userAgent = globalScope.navigator?.userAgent;
  return typeof userAgent === "string" && userAgent.includes("Electron");
}
