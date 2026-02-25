// File: apps/web/src/contexts/PlaylistContextMenuContext.tsx

"use client";

import type { Track } from "@starchild/types";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface PlaylistContextMenuItem {
  id: number;
  name: string;
  userId?: string;
  description?: string | null;
  isPublic?: boolean;
  coverImage?: string | null;
  createdAt?: Date;
  updatedAt?: Date | null;
  trackCount?: number;
  tracks?: Array<{
    id: number;
    track: Track;
    position: number;
    addedAt: Date;
  }>;
}

export interface PlaylistContextMenuOptions {
  mode?: "owner" | "foreign";
  openPath?: string;
  shareUrl?: string;
  resolveTracks?: () => Promise<Track[]>;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface PlaylistContextMenuContextType {
  playlist: PlaylistContextMenuItem | null;
  position: MenuPosition | null;
  options: PlaylistContextMenuOptions;
  openMenu: (
    playlist: PlaylistContextMenuItem,
    x: number,
    y: number,
    options?: PlaylistContextMenuOptions,
  ) => void;
  closeMenu: () => void;
}

const PlaylistContextMenuContext = createContext<PlaylistContextMenuContextType | undefined>(
  undefined,
);

export function PlaylistContextMenuProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<PlaylistContextMenuItem | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [options, setOptions] = useState<PlaylistContextMenuOptions>({
    mode: "owner",
  });

  const openMenu = useCallback(
    (
      playlist: PlaylistContextMenuItem,
      x: number,
      y: number,
      options?: PlaylistContextMenuOptions,
    ) => {
      setPlaylist(playlist);
      setPosition({ x, y });
      setOptions({ mode: "owner", ...options });
    },
    [],
  );

  const closeMenu = useCallback(() => {
    setPlaylist(null);
    setPosition(null);
    setOptions({ mode: "owner" });
  }, []);

  return (
    <PlaylistContextMenuContext.Provider
      value={{ playlist, position, options, openMenu, closeMenu }}
    >
      {children}
    </PlaylistContextMenuContext.Provider>
  );
}

export function usePlaylistContextMenu() {
  const context = useContext(PlaylistContextMenuContext);
  if (!context) {
    throw new Error("usePlaylistContextMenu must be used within PlaylistContextMenuProvider");
  }
  return context;
}
