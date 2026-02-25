// File: apps/web/src/contexts/KeyboardShortcutsProvider.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { type ReactNode, useMemo } from "react";

export const VISUALIZER_SHORTCUT_TOGGLE_EVENT =
  "starchild:shortcut-toggle-visualizer";

export function KeyboardShortcutsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const player = useGlobalPlayer();

  const handlers = useMemo(
    () => ({
      onPlayPause: () => {
        void player.togglePlay();
      },
      onNext: player.playNext,
      onPrevious: player.playPrevious,
      onVolumeUp: () => {
        player.setVolume(Math.min(1, player.volume + 0.1));
      },
      onVolumeDown: () => {
        player.setVolume(Math.max(0, player.volume - 0.1));
      },
      onMute: () => {
        player.setIsMuted(!player.isMuted);
      },
      onSeekForward: player.skipForward,
      onSeekBackward: player.skipBackward,
      onToggleShuffle: player.toggleShuffle,
      onToggleRepeat: player.cycleRepeatMode,
      onToggleVisualizer: () => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new Event(VISUALIZER_SHORTCUT_TOGGLE_EVENT));
      },
    }),
    [player],
  );

  useKeyboardShortcuts(handlers);

  return <>{children}</>;
}
