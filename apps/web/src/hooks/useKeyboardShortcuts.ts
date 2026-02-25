// File: apps/web/src/hooks/useKeyboardShortcuts.ts

"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutHandlers {
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onToggleVisualizer?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {

    if (typeof window !== "undefined" && window.electron) {
      const handleMediaKey = (key: string) => {
        switch (key) {
          case "play-pause":
            handlersRef.current.onPlayPause?.();
            break;
          case "next":
            handlersRef.current.onNext?.();
            break;
          case "previous":
            handlersRef.current.onPrevious?.();
            break;
        }
      };

      window.electron.onMediaKey(handleMediaKey);

      return () => {
        window.electron?.removeMediaKeyListener();
      };
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handlersRef.current.onPlayPause?.();
        return;
      }

      if (e.code === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) {
          handlersRef.current.onNext?.();
        } else {
          handlersRef.current.onSeekForward?.();
        }
        return;
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) {
          handlersRef.current.onPrevious?.();
        } else {
          handlersRef.current.onSeekBackward?.();
        }
        return;
      }

      if (e.code === "ArrowUp") {
        e.preventDefault();
        handlersRef.current.onVolumeUp?.();
        return;
      }

      if (e.code === "ArrowDown") {
        e.preventDefault();
        handlersRef.current.onVolumeDown?.();
        return;
      }

      if (e.code === "KeyM") {
        e.preventDefault();
        handlersRef.current.onMute?.();
        return;
      }

      if (e.code === "KeyS") {
        e.preventDefault();
        handlersRef.current.onToggleShuffle?.();
        return;
      }

      if (e.code === "KeyR") {
        e.preventDefault();
        handlersRef.current.onToggleRepeat?.();
        return;
      }

      if (e.code === "KeyV") {
        e.preventDefault();
        handlersRef.current.onToggleVisualizer?.();
        return;
      }

      // V - Toggle visualizer
      if (e.code === "KeyV") {
        e.preventDefault();
        handlers.onToggleVisualizer?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
