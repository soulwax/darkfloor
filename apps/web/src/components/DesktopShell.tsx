// File: apps/web/src/components/DesktopShell.tsx

"use client";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { DesktopSidebar } from "./DesktopSidebar";

export function DesktopShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const isLinuxElectron =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";
  const isTauriDesktop =
    typeof window !== "undefined" && window.starchildTauri?.isTauri === true;

  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
      document.documentElement.classList.remove("desktop-compact-mode");
      return;
    }

    document.documentElement.style.setProperty(
      "--desktop-right-rail-width",
      "0px",
    );

    return () => {
      document.documentElement.style.removeProperty(
        "--desktop-right-rail-width",
      );
      document.documentElement.classList.remove("desktop-compact-mode");
    };
  }, [isMobile]);

  if (isMobile) return <>{children}</>;

  return (
    <div
      className={`desktop-shell flex h-screen w-full overflow-hidden ${
        isTauriDesktop ? "is-tauri-desktop-shell" : ""
      }`}
      style={isLinuxElectron ? { paddingTop: "36px" } : undefined}
    >
      <DesktopSidebar />
      <div className="desktop-main flex min-h-0 min-w-0 flex-1 flex-col p-2 md:p-2.5">
        <div className="desktop-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.95rem] border">
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
