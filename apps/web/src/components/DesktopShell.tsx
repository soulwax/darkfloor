// File: apps/web/src/components/DesktopShell.tsx

"use client";

import { useCompactModePreference } from "@/hooks/useCompactModePreference";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { DesktopSidebar } from "./DesktopSidebar";

export function DesktopShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { compactMode } = useCompactModePreference();
  const isLinuxElectron =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";

  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
      document.documentElement.classList.remove("desktop-compact-mode");
      return;
    }

    document.documentElement.classList.toggle(
      "desktop-compact-mode",
      compactMode,
    );

    const applyRightRailWidth = () => {
      document.documentElement.style.setProperty(
        "--desktop-right-rail-width",
        "0px",
      );
    };

    applyRightRailWidth();

    return () => {
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
      document.documentElement.classList.remove("desktop-compact-mode");
    };
  }, [compactMode, isMobile]);

  if (isMobile) return <>{children}</>;

  return (
    <div
      className={`desktop-shell flex h-screen w-full overflow-hidden ${
        compactMode ? "desktop-shell-compact" : ""
      }`}
      style={{ paddingTop: isLinuxElectron ? "36px" : "0" }}
    >
      <DesktopSidebar />
      <div
        className={`desktop-main flex min-h-0 min-w-0 flex-1 flex-col ${
          compactMode ? "p-1 md:p-1.5" : "p-2 md:p-2.5"
        }`}
      >
        <div
          className={`desktop-surface flex min-h-0 flex-1 flex-col overflow-hidden border ${
            compactMode ? "rounded-[0.95rem]" : "rounded-[1.2rem]"
          }`}
        >
          <div className="desktop-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="desktop-stage flex min-h-full flex-col">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
