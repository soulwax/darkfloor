// File: apps/web/src/components/DesktopShell.tsx

"use client";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { DesktopRightRail } from "./DesktopRightRail";
import { DesktopSidebar } from "./DesktopSidebar";

export function DesktopShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const rightRailWidth = 320;
  const isLinuxElectron =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";

  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const applyRightRailWidth = () => {
      document.documentElement.style.setProperty(
        "--desktop-right-rail-width",
        mediaQuery.matches ? `${rightRailWidth}px` : "0px",
      );
    };

    applyRightRailWidth();
    mediaQuery.addEventListener("change", applyRightRailWidth);

    return () => {
      mediaQuery.removeEventListener("change", applyRightRailWidth);
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
    };
  }, [isMobile]);

  if (isMobile) return <>{children}</>;

  return (
    <div
      className="desktop-shell flex h-screen w-full overflow-hidden"
      style={{ paddingTop: isLinuxElectron ? "36px" : "0" }}
    >
      <DesktopSidebar />
      <div className="desktop-main min-w-0 flex-1 p-2 md:p-3">
        <div className="desktop-surface flex h-full min-h-0 flex-col overflow-hidden rounded-[1.25rem] border">
          <div className="desktop-scroll min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
      <DesktopRightRail />
    </div>
  );
}
