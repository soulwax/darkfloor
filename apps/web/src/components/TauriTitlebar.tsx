"use client";

import emilyLogo from "../../public/emily-the-strange.png";

import { Maximize2, Minimize2, Minus, Settings, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

type TauriWindowState = {
  isMaximized: boolean;
};

const isTauriWindowState = (value: unknown): value is TauriWindowState => {
  if (!value || typeof value !== "object") return false;
  const payload = value as { isMaximized?: unknown };
  return typeof payload.isMaximized === "boolean";
};

export function TauriTitlebar() {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const ts = useTranslations("shell");
  const [isTauri] = useState(
    () =>
      typeof window !== "undefined" && window.starchildTauri?.isTauri === true,
  );
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    const tauri = window.starchildTauri;
    if (!tauri?.isTauri) return;

    const syncState = async () => {
      try {
        const state = await tauri.syncWindowState();
        if (isTauriWindowState(state)) {
          setIsMaximized(state.isMaximized);
        }
      } catch (error) {
        console.warn(
          "[TauriTitlebar] Failed to sync Tauri window state",
          error,
        );
      }
    };

    const handleState = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      if (!isTauriWindowState(customEvent.detail)) return;
      setIsMaximized(customEvent.detail.isMaximized);
    };

    window.addEventListener(
      "starchild:tauri-window-state",
      handleState as EventListener,
    );
    void syncState();

    return () => {
      window.removeEventListener(
        "starchild:tauri-window-state",
        handleState as EventListener,
      );
    };
  }, [isTauri]);

  const tabs = useMemo(
    () => [
      { href: "/", label: tc("home") },
      { href: "/library", label: tc("library") },
      { href: "/playlists", label: tc("playlists") },
      { href: "/settings", label: tc("settings"), icon: Settings },
    ],
    [tc],
  );

  if (!isTauri) return null;

  const invokeWindowAction = async (
    action: "minimize" | "toggleMaximize" | "close",
  ) => {
    const tauri = window.starchildTauri;
    if (!tauri?.isTauri) return;

    try {
      if (action === "minimize") {
        await tauri.minimize();
        return;
      }
      if (action === "close") {
        await tauri.close();
        return;
      }

      const nextState = await tauri.toggleMaximize();
      if (isTauriWindowState(nextState)) {
        setIsMaximized(nextState.isMaximized);
      }
    } catch (error) {
      console.warn(`[TauriTitlebar] Failed to ${action}`, error);
    }
  };

  return (
    <header className="tauri-titlebar fixed inset-x-0 top-0 z-40 px-[var(--desktop-window-frame-gap)] pt-[var(--desktop-window-frame-gap)]">
      <div className="tauri-titlebar-shell grid grid-cols-[minmax(10rem,1fr)_auto_minmax(6rem,1fr)_auto] items-center gap-3 rounded-[calc(var(--desktop-window-radius)-0.3rem)] border px-3 py-2">
        <div
          className="tauri-drag-region flex min-w-0 items-center gap-3 rounded-full px-2 py-1.5"
          data-tauri-drag-region
        >
          <div className="pointer-events-none flex items-center gap-3">
            <Image
              src={emilyLogo}
              alt="Starchild"
              width={28}
              height={28}
              className="h-7 w-7 rounded-xl"
              priority
              unoptimized
            />
          </div>
          <div className="pointer-events-none min-w-0">
            <div className="truncate text-sm font-semibold tracking-[0.02em] text-[var(--color-text)]">
              Starchild
            </div>
            <div className="truncate text-[10px] font-medium tracking-[0.16em] text-[var(--color-muted)] uppercase">
              Tauri preview
            </div>
          </div>
        </div>

        <nav
          className="tauri-tabbar electron-no-drag flex items-center gap-1 rounded-full border px-1 py-1"
          aria-label="Desktop tabs"
        >
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tauri-tab flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "is-active bg-[rgba(244,178,102,0.16)] text-[var(--color-text)]"
                    : "text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div
          className="tauri-drag-region h-10 rounded-full"
          data-tauri-drag-region
        />

        <div
          className="tauri-window-controls electron-no-drag"
          role="group"
          aria-label={ts("windowControls")}
        >
          <div className="tauri-window-controls-shell">
            <button
              type="button"
              className="tauri-window-control"
              aria-label={ts("minimizeWindow")}
              title={ts("minimize")}
              onClick={() => void invokeWindowAction("minimize")}
            >
              <Minus className="h-3.5 w-3.5 stroke-[2.4]" />
            </button>
            <button
              type="button"
              className="tauri-window-control"
              aria-label={
                isMaximized ? ts("restoreWindow") : ts("maximizeWindow")
              }
              title={isMaximized ? ts("restore") : ts("maximize")}
              onClick={() => void invokeWindowAction("toggleMaximize")}
            >
              {isMaximized ? (
                <Minimize2 className="h-[11px] w-[11px] stroke-[2.3]" />
              ) : (
                <Maximize2 className="h-[11px] w-[11px] stroke-[2.3]" />
              )}
            </button>
            <button
              type="button"
              className="tauri-window-control tauri-window-control-close"
              aria-label={ts("closeWindow")}
              title={ts("close")}
              onClick={() => void invokeWindowAction("close")}
            >
              <X className="h-3.5 w-3.5 stroke-[2.4]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
