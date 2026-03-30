import { startTransition, useDeferredValue, useState } from "react";
import type { Track } from "@starchild/player-core";

import { createInitialMobileShellState } from "../index";
import { MOBILE_DEMO_LIBRARY, MOBILE_NAV_TABS } from "./data";
import type { MobileShellState, MobileTabId } from "./types";

interface MobileShellController {
  navTabs: typeof MOBILE_NAV_TABS;
  searchResults: Track[];
  searchQuery: string;
  activeTab: MobileTabId;
  state: MobileShellState;
  deferredSearchQuery: string;
  setActiveTab: (tabId: MobileTabId) => void;
  setSearchQuery: (value: string) => void;
}

function matchesTrack(track: Track, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  return [
    track.title,
    track.artist.name,
    track.album.title,
    track.release_date ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function collectSearchTracks(): Track[] {
  const allTracks = [
    MOBILE_DEMO_LIBRARY.nowPlaying.track,
    ...MOBILE_DEMO_LIBRARY.upNext.map((queuedTrack) => queuedTrack.track),
    ...MOBILE_DEMO_LIBRARY.favoriteTracks,
    ...MOBILE_DEMO_LIBRARY.recommendedTracks,
    ...MOBILE_DEMO_LIBRARY.recentTracks,
  ];

  const dedupedTracks = new Map<number, Track>();

  allTracks.forEach((track) => {
    if (!dedupedTracks.has(track.id)) {
      dedupedTracks.set(track.id, track);
    }
  });

  return [...dedupedTracks.values()];
}

const searchableTracks = collectSearchTracks();

export function useMobileShellState(): MobileShellController {
  const [state, setState] = useState<MobileShellState>(
    createInitialMobileShellState(),
  );
  const deferredSearchQuery = useDeferredValue(state.searchQuery.trim());

  const searchResults = searchableTracks.filter((track) =>
    matchesTrack(track, deferredSearchQuery),
  );

  function setActiveTab(tabId: MobileTabId): void {
    startTransition(() => {
      setState((currentState) => ({
        ...currentState,
        activeTab: tabId,
      }));
    });
  }

  function setSearchQuery(value: string): void {
    setState((currentState) => {
      const trimmedValue = value.trim();
      const nextTab =
        trimmedValue.length > 0
          ? "search"
          : currentState.activeTab === "search"
            ? "home"
            : currentState.activeTab;

      return {
        ...currentState,
        activeTab: nextTab,
        searchQuery: value,
      };
    });
  }

  return {
    navTabs: MOBILE_NAV_TABS,
    searchResults,
    searchQuery: state.searchQuery,
    activeTab: state.activeTab,
    state,
    deferredSearchQuery,
    setActiveTab,
    setSearchQuery,
  };
}
