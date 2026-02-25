// File: apps/web/src/components/UIWrapper.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { type ReactNode } from "react";

interface UIWrapperProps {
  children: ReactNode;
}

export function UIWrapper({ children }: UIWrapperProps) {
  const { hideUI } = useGlobalPlayer();
  const isMobile = useIsMobile();

  if (isMobile) {
    return <>{children}</>;
  }

  return (
    <div className={hideUI ? "hidden" : ""}>
      {children}
    </div>
  );
}
