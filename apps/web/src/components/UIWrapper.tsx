// File: apps/web/src/components/UIWrapper.tsx

"use client";

import { AudioPlayerContext } from "@starchild/player-react/AudioPlayerContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { type ReactNode, useContext } from "react";

interface UIWrapperProps {
  children: ReactNode;
}

export function UIWrapper({ children }: UIWrapperProps) {
  const player = useContext(AudioPlayerContext);
  const hideUI = player?.hideUI ?? false;
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
