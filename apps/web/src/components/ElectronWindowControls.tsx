// File: apps/web/src/components/ElectronWindowControls.tsx

"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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

export function ElectronWindowControls() {
  const t = useTranslations("shell");
  const [isLinuxElectron] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.electron?.isElectron) &&
      window.electron?.platform === "linux",
  );
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isLinuxElectron) return;

    window.electron?.receive?.("fromMain", (...args) => {
      const message = args[0];
      if (!isWindowStateMessage(message)) return;
      setIsMaximized(message.isMaximized);
    });

    window.electron?.send?.("toMain", { type: "window:getState" });
  }, [isLinuxElectron]);

  if (!isLinuxElectron) return null;

  return (
    <div
      className="electron-window-controls"
      role="group"
      aria-label={t("windowControls")}
    >
      <div className="electron-window-controls-shell">
        <button
          type="button"
          aria-label={t("minimizeWindow")}
          title={t("minimize")}
          className="electron-window-control electron-window-control-minimize"
          onClick={() =>
            window.electron?.send?.("toMain", { type: "window:minimize" })
          }
        >
          <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>

        <button
          type="button"
          aria-label={isMaximized ? t("restoreWindow") : t("maximizeWindow")}
          title={isMaximized ? t("restore") : t("maximize")}
          className="electron-window-control electron-window-control-maximize"
          onClick={() =>
            window.electron?.send?.("toMain", { type: "window:toggleMaximize" })
          }
        >
          {isMaximized ? (
            <Minimize2 className="h-[11px] w-[11px] stroke-[2.3]" />
          ) : (
            <Maximize2 className="h-[11px] w-[11px] stroke-[2.3]" />
          )}
        </button>

        <button
          type="button"
          aria-label={t("closeWindow")}
          title={t("close")}
          className="electron-window-control electron-window-control-close"
          onClick={() =>
            window.electron?.send?.("toMain", { type: "window:close" })
          }
        >
          <X className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
