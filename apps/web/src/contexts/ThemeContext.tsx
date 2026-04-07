// File: apps/web/src/contexts/ThemeContext.tsx

"use client";

import { api } from "@starchild/api-client/trpc/react";
import {
  applyColorSchemeToDocument,
} from "@/config/colorSchemes";
import {
  SETTINGS_UPDATED_EVENT,
  settingsStorage,
} from "@/utils/settingsStorage";
import {
  DEFAULT_COLOR_SCHEME,
  normalizeColorSchemeId,
  type ColorSchemeId,
} from "@starchild/types/settings";
import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextValue {
  theme: "light" | "dark";
  colorScheme: ColorSchemeId;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  colorScheme: DEFAULT_COLOR_SCHEME,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [localColorScheme, setLocalColorScheme] = useState<ColorSchemeId>(() =>
    normalizeColorSchemeId(
      settingsStorage.getSetting("colorScheme", DEFAULT_COLOR_SCHEME),
    ),
  );

  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    {
      enabled: !!session,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  const effectiveTheme = "dark" as const;
  const effectiveColorScheme = normalizeColorSchemeId(
    session ? preferences?.colorScheme ?? localColorScheme : localColorScheme,
  );

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          key?: string;
          value?: unknown;
        }>
      ).detail;

      if (detail?.key !== "colorScheme") {
        return;
      }

      setLocalColorScheme(normalizeColorSchemeId(detail.value));
    };

    window.addEventListener(
      SETTINGS_UPDATED_EVENT,
      handleSettingsUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    applyColorSchemeToDocument(effectiveColorScheme);

    const localTheme = settingsStorage.getSetting("theme", "dark");
    if (localTheme !== "dark") {
      settingsStorage.set("theme", "dark");
    }

    const storedColorScheme = normalizeColorSchemeId(
      settingsStorage.getSetting("colorScheme", DEFAULT_COLOR_SCHEME),
    );
    if (storedColorScheme !== effectiveColorScheme) {
      settingsStorage.set("colorScheme", effectiveColorScheme);
    }
  }, [effectiveColorScheme]);

  return (
    <ThemeContext.Provider
      value={{ theme: effectiveTheme, colorScheme: effectiveColorScheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
