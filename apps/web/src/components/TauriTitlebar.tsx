"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { Minus, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type TauriWindowState = {
  isMaximized: boolean;
};

type TauriPlatform = "windows" | "macos" | "linux" | "unknown";

const isTauriWindowState = (value: unknown): value is TauriWindowState => {
  if (!value || typeof value !== "object") return false;
  const payload = value as { isMaximized?: unknown };
  return typeof payload.isMaximized === "boolean";
};

const shouldSkipWindowDrag = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-no-window-drag='true']"));
};

const detectTauriPlatform = (): TauriPlatform => {
  if (typeof navigator === "undefined") return "unknown";

  const candidateNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const rawPlatform = (
    candidateNavigator.userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent
  ).toLowerCase();

  if (rawPlatform.includes("mac")) return "macos";
  if (rawPlatform.includes("win")) return "windows";
  if (rawPlatform.includes("linux")) return "linux";
  return "unknown";
};

export function TauriTitlebar() {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const tsh = useTranslations("shell");
  const { currentTrack, isPlaying } = useGlobalPlayer();
  const [isTauri, setIsTauri] = useState(false);
  const [platform, setPlatform] = useState<TauriPlatform>("unknown");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setIsTauri(window.starchildTauri?.isTauri === true);
    setPlatform(detectTauriPlatform());
  }, []);

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

  const sectionLabel = useMemo(() => {
    if (pathname === "/") return tc("home");
    if (pathname.startsWith("/library")) return tc("library");
    if (pathname.startsWith("/playlists")) return tc("playlists");
    if (pathname.startsWith("/settings")) return tc("settings");
    if (pathname.startsWith("/spotify")) return tc("spotify");
    if (pathname.startsWith("/admin")) return tc("admin");
    if (pathname.startsWith("/about")) return tc("about");
    if (pathname.startsWith("/license")) return tc("license");
    if (pathname.startsWith("/album")) return tc("album");
    if (pathname.startsWith("/artist")) return tc("artist");
    if (pathname.startsWith("/signin")) return tc("signIn");
    if (pathname.split("/").filter(Boolean).length === 1) return tc("profile");
    return "Starchild";
  }, [pathname, tc]);

  if (!isTauri) return null;

  const trimmedTitle = currentTrack?.title?.trim();
  const trimmedArtistName = currentTrack?.artist?.name?.trim();
  const windowTitle =
    trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : "Starchild";
  const windowSubtitle = currentTrack
    ? trimmedArtistName && trimmedArtistName.length > 0
      ? trimmedArtistName
      : tc("unknownArtist")
    : sectionLabel;

  const invokeWindowAction = async (
    action: "minimize" | "toggleMaximize" | "close" | "startDragging",
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

      if (action === "startDragging") {
        await tauri.startDragging();
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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.detail > 1 ||
      shouldSkipWindowDrag(event.target)
    ) {
      return;
    }

    void invokeWindowAction("startDragging");
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (platform !== "windows" || shouldSkipWindowDrag(event.target)) {
      return;
    }

    void invokeWindowAction("toggleMaximize");
  };

  return (
    <header className="tauri-titlebar fixed inset-x-0 top-0 z-40 px-[var(--desktop-window-frame-gap)] pt-[var(--desktop-window-frame-gap)]">
      <div
        className="tauri-titlebar-shell theme-chrome-header rounded-[calc(var(--desktop-window-radius)-1px)] border px-3 py-2"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <div className="tauri-titlebar-inner">
          <div
            className="tauri-window-controls"
            role="group"
            aria-label={tsh("windowControls")}
            data-no-window-drag="true"
          >
            <div className="tauri-window-controls-shell tauri-window-controls-shell-traffic">
              <button
                type="button"
                className="tauri-window-control tauri-window-control-traffic tauri-window-control-close"
                aria-label={tsh("closeWindow")}
                title={tsh("close")}
                onClick={() => void invokeWindowAction("close")}
                data-no-window-drag="true"
              >
                <X className="h-[8px] w-[8px] stroke-[2.6]" />
              </button>
              <button
                type="button"
                className="tauri-window-control tauri-window-control-traffic tauri-window-control-minimize"
                aria-label={tsh("minimizeWindow")}
                title={tsh("minimize")}
                onClick={() => void invokeWindowAction("minimize")}
                data-no-window-drag="true"
              >
                <Minus className="h-[8px] w-[8px] stroke-[2.6]" />
              </button>
              <button
                type="button"
                className="tauri-window-control tauri-window-control-traffic tauri-window-control-maximize"
                aria-label={
                  isMaximized ? tsh("restoreWindow") : tsh("maximizeWindow")
                }
                title={isMaximized ? tsh("restore") : tsh("maximize")}
                onClick={() => void invokeWindowAction("toggleMaximize")}
                data-no-window-drag="true"
              >
                {isMaximized ? (
                  <Plus className="h-[8px] w-[8px] rotate-45 stroke-[2.6]" />
                ) : (
                  <Plus className="h-[8px] w-[8px] stroke-[2.6]" />
                )}
              </button>
            </div>
          </div>

          <div
            className="tauri-titlebar-drag-zone flex min-w-0 flex-1 items-center justify-center"
            data-tauri-drag-region
          >
            <div
              className="tauri-titlebar-copy tauri-titlebar-copy-centered min-w-0"
              data-tauri-drag-region
            >
              <div className="tauri-titlebar-trackline tauri-titlebar-trackline-centered flex min-w-0 items-center justify-center gap-2">
                <span
                  className={`tauri-titlebar-signal ${currentTrack && isPlaying ? "is-playing" : ""}`}
                  aria-hidden="true"
                />
                <span className="tauri-titlebar-track truncate">
                  {windowTitle}
                </span>
              </div>
              <div className="tauri-titlebar-track-meta tauri-titlebar-track-meta-centered truncate">
                {windowSubtitle}
              </div>
            </div>
          </div>

          <div
            className="tauri-titlebar-actions tauri-titlebar-actions-spacer"
            data-no-window-drag="true"
            aria-hidden="true"
          />
        </div>
      </div>
    </header>
  );
}
