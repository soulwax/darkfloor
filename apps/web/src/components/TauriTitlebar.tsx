"use client";

import { AudioPlayerContext } from "@starchild/player-react/AudioPlayerContext";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type TauriWindowState = {
  isMaximized: boolean;
};

type TauriPlatform = "windows" | "macos" | "linux" | "unknown";
type DragIntent = {
  pointerId: number;
  startX: number;
  startY: number;
};

const WINDOW_DRAG_THRESHOLD_PX = 4;

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
  const player = useContext(AudioPlayerContext);
  const currentTrack = player?.currentTrack ?? null;
  const isPlaying = player?.isPlaying ?? false;
  const [isTauri, setIsTauri] = useState(false);
  const [platform, setPlatform] = useState<TauriPlatform>("unknown");
  const [isMaximized, setIsMaximized] = useState(false);
  const dragIntentRef = useRef<DragIntent | null>(null);
  const isStartingDragRef = useRef(false);

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
    if (event.button !== 0 || shouldSkipWindowDrag(event.target)) {
      return;
    }

    dragIntentRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Best effort only.
    }
  };

  const clearDragIntent = (
    event?: ReactPointerEvent<HTMLDivElement>,
    options?: { releasePointerCapture?: boolean },
  ) => {
    const pointerId = dragIntentRef.current?.pointerId;
    dragIntentRef.current = null;

    if (
      options?.releasePointerCapture &&
      event &&
      pointerId !== undefined &&
      event.currentTarget.hasPointerCapture(pointerId)
    ) {
      try {
        event.currentTarget.releasePointerCapture(pointerId);
      } catch {
        // Best effort only.
      }
    }
  };

  const handlePointerMove = async (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const dragIntent = dragIntentRef.current;
    if (
      !dragIntent ||
      dragIntent.pointerId !== event.pointerId ||
      isStartingDragRef.current
    ) {
      return;
    }

    const deltaX = event.clientX - dragIntent.startX;
    const deltaY = event.clientY - dragIntent.startY;
    if (Math.hypot(deltaX, deltaY) < WINDOW_DRAG_THRESHOLD_PX) {
      return;
    }

    isStartingDragRef.current = true;
    clearDragIntent(event, { releasePointerCapture: true });

    try {
      if (platform === "windows" && isMaximized) {
        const nextState = await window.starchildTauri?.toggleMaximize();
        if (isTauriWindowState(nextState)) {
          setIsMaximized(nextState.isMaximized);
        }
      }

      await invokeWindowAction("startDragging");
    } finally {
      isStartingDragRef.current = false;
    }
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (platform !== "windows" || shouldSkipWindowDrag(event.target)) {
      return;
    }

    dragIntentRef.current = null;
    void invokeWindowAction("toggleMaximize");
  };

  return (
    <header className="tauri-titlebar fixed inset-x-0 top-0 z-40 px-[var(--desktop-window-frame-gap)] pt-[var(--desktop-window-frame-gap)]">
      <div
        className="tauri-titlebar-shell theme-chrome-header rounded-[calc(var(--desktop-window-radius)-1px)] border px-3 py-2"
        data-tauri-drag-region
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => {
          void handlePointerMove(event);
        }}
        onPointerUp={(event) => {
          clearDragIntent(event, { releasePointerCapture: true });
        }}
        onPointerCancel={(event) => {
          clearDragIntent(event, { releasePointerCapture: true });
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="tauri-titlebar-inner">
          <div className="tauri-titlebar-actions tauri-titlebar-actions-spacer" />

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
            className="tauri-window-controls tauri-window-controls-windows"
            role="group"
            aria-label={tsh("windowControls")}
            data-no-window-drag="true"
          >
            <div className="tauri-window-controls-shell tauri-window-controls-shell-windows">
              <button
                type="button"
                className="tauri-window-control tauri-window-control-windows tauri-window-control-minimize"
                aria-label={tsh("minimizeWindow")}
                title={tsh("minimize")}
                onClick={() => void invokeWindowAction("minimize")}
                data-no-window-drag="true"
              >
                <span className="tauri-window-glyph tauri-window-glyph-minimize" />
              </button>
              <button
                type="button"
                className="tauri-window-control tauri-window-control-windows tauri-window-control-maximize"
                aria-label={
                  isMaximized ? tsh("restoreWindow") : tsh("maximizeWindow")
                }
                title={isMaximized ? tsh("restore") : tsh("maximize")}
                onClick={() => void invokeWindowAction("toggleMaximize")}
                data-no-window-drag="true"
              >
                <span
                  className={`tauri-window-glyph tauri-window-glyph-maximize ${
                    isMaximized ? "is-maximized" : ""
                  }`}
                />
              </button>
              <button
                type="button"
                className="tauri-window-control tauri-window-control-windows tauri-window-control-close"
                aria-label={tsh("closeWindow")}
                title={tsh("close")}
                onClick={() => void invokeWindowAction("close")}
                data-no-window-drag="true"
              >
                <span className="tauri-window-glyph tauri-window-glyph-close" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
