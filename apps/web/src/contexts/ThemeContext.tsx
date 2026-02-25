// File: apps/web/src/contexts/ThemeContext.tsx

"use client";

import { api } from "@starchild/api-client/trpc/react";
import { settingsStorage } from "@/utils/settingsStorage";
import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect } from "react";

interface ThemeContextValue {
  theme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark" });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    {
      enabled: !!session,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  const effectiveTheme: "dark" = "dark";

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.classList.add("theme-dark");
    htmlElement.classList.remove("theme-light");

    const localTheme = settingsStorage.getSetting("theme", "dark");
    if (localTheme !== "dark") {
      settingsStorage.set("theme", "dark");
    }
  }, [session?.user?.id, preferences?.theme]);

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
