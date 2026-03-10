// File: apps/web/src/components/LinuxTitlebar.tsx

"use client";

import { APP_VERSION } from "@/config/version";
import { useContext, useEffect, useState } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { AudioPlayerContext } from "@starchild/player-react/AudioPlayerContext";
import { useTranslations } from "next-intl";

export function LinuxTitlebar() {
  const t = useTranslations("shell");
  const [isMaximized, setIsMaximized] = useState(false);
  const isLinux =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";
  const sendToMain = (
    type:
      | "window:getState"
      | "window:minimize"
      | "window:toggleMaximize"
      | "window:close",
  ) => {
    if (!window.electron?.send) {
      console.warn(
        `[LinuxTitlebar] Missing window.electron.send while dispatching "${type}"`,
      );
      return;
    }
    window.electron.send("toMain", { type });
  };

  // Use context directly to avoid throwing error if provider isn't available yet
  const audioPlayerContext = useContext(AudioPlayerContext);
  const currentTrack = audioPlayerContext?.currentTrack ?? null;

  useEffect(() => {
    if (!isLinux) return;
    if (!window.electron?.receive) {
      console.warn(
        "[LinuxTitlebar] Missing window.electron.receive; maximize state updates will not arrive.",
      );
      return;
    }

    // Request initial window state
    sendToMain("window:getState");

    // Listen for window state updates
    window.electron.receive("fromMain", (message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "windowState" &&
        "isMaximized" in message
      ) {
        setIsMaximized(Boolean(message.isMaximized));
      }
    });
  }, [isLinux]);

  if (!isLinux) return null;

  const handleMinimize = () => {
    sendToMain("window:minimize");
  };

  const handleMaximize = () => {
    sendToMain("window:toggleMaximize");
  };

  const handleClose = () => {
    sendToMain("window:close");
  };

  // Determine title text based on playback state
  const titleText =
    currentTrack?.title && currentTrack.artist?.name
      ? `${currentTrack.title} - ${currentTrack.artist.name}`
      : `Starchild ${APP_VERSION}`;

  return (
    <div
      className="linux-titlebar fixed top-0 right-0 left-0 z-[9999] h-9 border-b select-none"
      style={
        {
          backgroundColor: "var(--color-chrome-solid)",
          borderColor: "var(--color-border)",
          WebkitAppRegion: "drag",
        } as React.CSSProperties
      }
    >
      {/* Centered Title - Draggable Area */}
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-medium"
        style={
          {
            color: "var(--color-chrome-symbol)",
          } as React.CSSProperties
        }
      >
        <span className="truncate px-2">{titleText}</span>
      </div>

      {/* Window Controls - Absolute Positioned */}
      <div
        className="absolute top-0 right-3 flex h-9 items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="titlebar-button flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-[rgba(255,255,255,0.1)]"
          aria-label={t("minimize")}
          title={t("minimize")}
        >
          <Minus
            className="h-4 w-4"
            style={{ color: "var(--color-chrome-symbol)" }}
          />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="titlebar-button flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-[rgba(255,255,255,0.1)]"
          aria-label={isMaximized ? t("restore") : t("maximize")}
          title={isMaximized ? t("restore") : t("maximize")}
        >
          {isMaximized ? (
            <Square
              className="h-3.5 w-3.5"
              style={{ color: "var(--color-chrome-symbol)" }}
            />
          ) : (
            <Maximize2
              className="h-3.5 w-3.5"
              style={{ color: "var(--color-chrome-symbol)" }}
            />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="titlebar-button flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-[#f28b82] hover:text-white"
          aria-label={t("close")}
          title={t("close")}
        >
          <X
            className="h-4 w-4"
            style={{ color: "var(--color-chrome-symbol)" }}
          />
        </button>
      </div>
    </div>
  );
}
