"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useTranslations } from "next-intl";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

type WindowStateMessage = {
  type: "windowState";
  isMaximized: boolean;
};

const isWindowStateMessage = (value: unknown): value is WindowStateMessage => {
  if (!value || typeof value !== "object") return false;
  const payload = value as { type?: unknown; isMaximized?: unknown };
  return (
    payload.type === "windowState" && typeof payload.isMaximized === "boolean"
  );
};

export function LinuxTitlebar() {
  const t = useTranslations("shell");
  const { currentTrack, isPlaying } = useGlobalPlayer();
  const [isElectronDesktop, setIsElectronDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setIsElectronDesktop(window.electron?.isElectron === true);
  }, []);

  useEffect(() => {
    if (!isElectronDesktop) return;
    if (!window.electron?.receive) {
      console.warn(
        "[ElectronTitlebar] Missing window.electron.receive; maximize state updates will not arrive.",
      );
      return;
    }

    window.electron.receive("fromMain", (message: unknown) => {
      if (!isWindowStateMessage(message)) return;
      setIsMaximized(message.isMaximized);
    });

    window.electron.send?.("toMain", { type: "window:getState" });
  }, [isElectronDesktop]);

  if (!isElectronDesktop) return null;

  const handleWindowAction = (
    type: "window:minimize" | "window:toggleMaximize" | "window:close",
  ) => {
    window.electron?.send?.("toMain", { type });
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("[data-no-window-drag='true']")
    ) {
      return;
    }

    handleWindowAction("window:toggleMaximize");
  };

  const titleText = currentTrack?.title?.trim() || "Starchild";
  const subtitleText = currentTrack?.artist?.name?.trim() || "Desktop";

  return (
    <header className="electron-titlebar-overlay fixed top-0 right-0 left-0 z-[9999]">
      <div
        className="electron-titlebar-row electron-desktop-titlebar"
        onDoubleClick={handleDoubleClick}
      >
        <div className="electron-titlebar-spacer" />

        <div className="electron-titlebar-copy">
          <div className="electron-titlebar-trackline">
            <span
              className={`electron-titlebar-signal ${
                currentTrack && isPlaying ? "is-playing" : ""
              }`}
              aria-hidden="true"
            />
            <span className="electron-titlebar-title">{titleText}</span>
          </div>
          <div className="electron-titlebar-subtitle">{subtitleText}</div>
        </div>

        <div
          className="electron-titlebar-actions"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          data-no-window-drag="true"
        >
          <div className="electron-window-controls electron-window-controls-windows">
            <div className="electron-window-controls-shell electron-window-controls-shell-windows">
              <button
                type="button"
                aria-label={t("minimizeWindow")}
                title={t("minimize")}
                className="electron-window-control electron-window-control-windows electron-window-control-minimize"
                onClick={() => handleWindowAction("window:minimize")}
                data-no-window-drag="true"
              >
                <span className="electron-window-glyph electron-window-glyph-minimize" />
              </button>

              <button
                type="button"
                aria-label={
                  isMaximized ? t("restoreWindow") : t("maximizeWindow")
                }
                title={isMaximized ? t("restore") : t("maximize")}
                className="electron-window-control electron-window-control-windows electron-window-control-maximize"
                onClick={() => handleWindowAction("window:toggleMaximize")}
                data-no-window-drag="true"
              >
                <span
                  className={`electron-window-glyph electron-window-glyph-maximize ${
                    isMaximized ? "is-maximized" : ""
                  }`}
                />
              </button>

              <button
                type="button"
                aria-label={t("closeWindow")}
                title={t("close")}
                className="electron-window-control electron-window-control-windows electron-window-control-close"
                onClick={() => handleWindowAction("window:close")}
                data-no-window-drag="true"
              >
                <span className="electron-window-glyph electron-window-glyph-close" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
