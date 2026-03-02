// File: apps/web/src/hooks/useCompactModePreference.ts

"use client";

import { api } from "@starchild/api-client/trpc/react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  SETTINGS_UPDATED_EVENT,
  settingsStorage,
} from "@/utils/settingsStorage";

type UseCompactModePreferenceResult = {
  compactMode: boolean;
  setCompactMode: (nextValue: boolean) => void;
  toggleCompactMode: () => void;
};

export function useCompactModePreference(): UseCompactModePreferenceResult {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const utils = api.useUtils();

  const [guestCompactMode, setGuestCompactMode] = useState(() =>
    settingsStorage.getSetting("compactMode", false),
  );

  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    },
  );

  const updatePreferences = api.music.updatePreferences.useMutation();
  const sourceCompactMode = isAuthenticated
    ? (preferences?.compactMode ?? false)
    : guestCompactMode;
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated || typeof window === "undefined") return;

    const syncGuestCompactMode = () => {
      setGuestCompactMode(settingsStorage.getSetting("compactMode", false));
    };

    syncGuestCompactMode();
    window.addEventListener(SETTINGS_UPDATED_EVENT, syncGuestCompactMode);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, syncGuestCompactMode);
    };
  }, [isAuthenticated]);

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: clear optimistic override when source state catches up. */
  useEffect(() => {
    if (localOverride === null) return;
    if (localOverride !== sourceCompactMode) return;
    setLocalOverride(null);
  }, [localOverride, sourceCompactMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setCompactMode = useCallback(
    (nextValue: boolean) => {
      const previousValue = sourceCompactMode;
      setLocalOverride(nextValue);

      if (isAuthenticated) {
        utils.music.getUserPreferences.setData(undefined, (previous) =>
          previous ? { ...previous, compactMode: nextValue } : previous,
        );

        updatePreferences.mutate(
          { compactMode: nextValue },
          {
            onError: () => {
              setLocalOverride(previousValue);
              utils.music.getUserPreferences.setData(undefined, (previous) =>
                previous
                  ? { ...previous, compactMode: previousValue }
                  : previous,
              );
            },
            onSettled: () => {
              void utils.music.getUserPreferences.invalidate();
            },
          },
        );
        return;
      }

      settingsStorage.set("compactMode", nextValue);
      setGuestCompactMode(nextValue);
      setLocalOverride(null);
    },
    [isAuthenticated, sourceCompactMode, updatePreferences, utils],
  );

  const compactMode = localOverride ?? sourceCompactMode;
  const toggleCompactMode = useCallback(() => {
    setCompactMode(!compactMode);
  }, [compactMode, setCompactMode]);

  return {
    compactMode,
    setCompactMode,
    toggleCompactMode,
  };
}
