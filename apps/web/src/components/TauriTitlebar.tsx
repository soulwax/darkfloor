"use client";

import { APP_VERSION } from "@/config/version";
import emilyLogo from "../../public/emily-the-strange.png";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { Maximize2, Minimize2, Minus, Pause, Play, X } from "lucide-react";
import Image from "next/image";
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
  const tq = useTranslations("queue");
  const tp = useTranslations("player");
  const ts = useTranslations("search");
  const tsh = useTranslations("shell");
  const { currentTrack, isPlaying, queue, togglePlay } = useGlobalPlayer();
  const [isTauri] = useState(
    () =>
      typeof window !== "undefined" && window.starchildTauri?.isTauri === true,
  );
  const [platform] = useState<TauriPlatform>(() => detectTauriPlatform());
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
    return tc("home");
  }, [pathname, tc]);

  if (!isTauri) return null;

  const trimmedTitle = currentTrack?.title?.trim();
  const trimmedArtistName = currentTrack?.artist?.name?.trim();
  const titleText =
    trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : "Starchild";
  const subtitleText = currentTrack
    ? trimmedArtistName && trimmedArtistName.length > 0
      ? trimmedArtistName
      : tc("unknownArtist")
    : ts("placeholderShort");
  const statusText = currentTrack ? tq("nowPlaying") : tc("ready");
  const isMac = platform === "macos";

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
    if (shouldSkipWindowDrag(event.target)) {
      return;
    }

    void invokeWindowAction("toggleMaximize");
  };

  const handlePlayToggle = async () => {
    if (!currentTrack) return;

    try {
      await togglePlay();
    } catch (error) {
      console.warn("[TauriTitlebar] Failed to toggle playback", error);
    }
  };

  const windowControls = (
    <div
      className={`tauri-window-controls ${isMac ? "is-macos" : ""}`}
      role="group"
      aria-label={tsh("windowControls")}
      data-no-window-drag="true"
    >
      <div className="tauri-window-controls-shell">
        <button
          type="button"
          className="tauri-window-control tauri-window-control-minimize"
          aria-label={tsh("minimizeWindow")}
          title={tsh("minimize")}
          onClick={() => void invokeWindowAction("minimize")}
          data-no-window-drag="true"
        >
          <Minus className="h-3.5 w-3.5 stroke-[2.4]" />
        </button>
        <button
          type="button"
          className="tauri-window-control tauri-window-control-maximize"
          aria-label={
            isMaximized ? tsh("restoreWindow") : tsh("maximizeWindow")
          }
          title={isMaximized ? tsh("restore") : tsh("maximize")}
          onClick={() => void invokeWindowAction("toggleMaximize")}
          data-no-window-drag="true"
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
          aria-label={tsh("closeWindow")}
          title={tsh("close")}
          onClick={() => void invokeWindowAction("close")}
          data-no-window-drag="true"
        >
          <X className="h-3.5 w-3.5 stroke-[2.4]" />
        </button>
      </div>
    </div>
  );

  return (
    <header className="tauri-titlebar fixed inset-x-0 top-0 z-40 px-[var(--desktop-window-frame-gap)] pt-[var(--desktop-window-frame-gap)]">
      <div
        className="tauri-titlebar-shell theme-chrome-header rounded-[calc(var(--desktop-window-radius)-1px)] border px-3 py-2"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={`tauri-titlebar-inner ${isMac ? "tauri-titlebar-inner-macos" : ""}`}
        >
          {isMac ? windowControls : null}

          <div
            className="tauri-titlebar-drag-zone flex min-w-0 flex-1 items-center gap-3"
            data-tauri-drag-region
          >
            <div
              className="tauri-titlebar-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              data-tauri-drag-region
            >
              <Image
                src={emilyLogo}
                alt="Starchild"
                width={28}
                height={28}
                className="tauri-titlebar-brand-image h-7 w-7 rounded-xl"
                priority
                unoptimized
              />
            </div>

            <div className="tauri-titlebar-copy min-w-0" data-tauri-drag-region>
              <div className="tauri-titlebar-kicker flex items-center gap-2">
                <span className="tauri-titlebar-chip">{sectionLabel}</span>
                <span
                  className={`tauri-titlebar-signal ${currentTrack && isPlaying ? "is-playing" : ""}`}
                  aria-hidden="true"
                />
                <span className="truncate">{statusText}</span>
              </div>
              <div className="tauri-titlebar-trackline flex min-w-0 items-baseline gap-2">
                <span className="tauri-titlebar-track truncate">
                  {titleText}
                </span>
                <span className="tauri-titlebar-track-meta truncate">
                  {subtitleText}
                </span>
              </div>
            </div>
          </div>

          <div
            className="tauri-titlebar-actions flex items-center gap-2"
            data-no-window-drag="true"
          >
            <span className="tauri-titlebar-pill tauri-titlebar-queue hidden xl:inline-flex">
              {tp("inQueue", { count: queue.length })}
            </span>
            <span className="tauri-titlebar-pill tauri-titlebar-version">
              v{APP_VERSION}
            </span>
            {currentTrack ? (
              <button
                type="button"
                className="tauri-play-toggle inline-flex h-9 w-9 items-center justify-center rounded-full"
                aria-label={isPlaying ? tp("pauseTrack") : tp("playTrack")}
                title={isPlaying ? tp("pauseTrack") : tp("playTrack")}
                onClick={() => void handlePlayToggle()}
                data-no-window-drag="true"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>
            ) : null}
          </div>

          {!isMac ? windowControls : null}
        </div>
      </div>
    </header>
  );
}
