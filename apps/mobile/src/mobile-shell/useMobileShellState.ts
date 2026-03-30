import {
  startTransition,
  useDeferredValue,
  useEffect,
  useReducer,
} from "react";
import type { Track } from "@starchild/player-core";

import { createInitialMobileShellState } from "../index";
import { MOBILE_DEMO_LIBRARY, MOBILE_NAV_TABS } from "./data";
import { persistMobileShellState, restoreMobileShellState } from "./storage";
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

interface IndexedTrack {
  track: Track;
  searchKey: string;
}

type MobileShellAction =
  | {
      type: "set-active-tab";
      tabId: MobileTabId;
    }
  | {
      type: "set-search-query";
      value: string;
    };

const searchableTracks = collectSearchTracks();
const indexedTracks: readonly IndexedTrack[] = searchableTracks.map((track) => ({
  track,
  searchKey: [
    track.title,
    track.artist.name,
    track.album.title,
    track.release_date ?? "",
  ]
    .join("\n")
    .toLowerCase(),
}));

function createMobileShellState(): MobileShellState {
  return restoreMobileShellState(createInitialMobileShellState());
}

function mobileShellReducer(
  state: MobileShellState,
  action: MobileShellAction,
): MobileShellState {
  switch (action.type) {
    case "set-active-tab":
      return {
        ...state,
        activeTab: action.tabId,
      };
    case "set-search-query": {
      const trimmedValue = action.value.trim();
      const nextTab =
        trimmedValue.length > 0
          ? "search"
          : state.activeTab === "search"
            ? "home"
            : state.activeTab;

      return {
        ...state,
        activeTab: nextTab,
        searchQuery: action.value,
      };
    }
    default:
      return state;
  }
}

export function useMobileShellState(): MobileShellController {
  const [state, dispatch] = useReducer(
    mobileShellReducer,
    undefined,
    () => createMobileShellState(),
  );
  const deferredSearchQuery = useDeferredValue(state.searchQuery.trim());
  const normalizedDeferredSearchQuery = deferredSearchQuery.toLowerCase();

  const searchResults =
    normalizedDeferredSearchQuery.length === 0
      ? []
      : indexedTracks
          .filter((entry) =>
            entry.searchKey.includes(normalizedDeferredSearchQuery),
          )
          .map((entry) => entry.track);

  useEffect(() => {
    persistMobileShellState(state);
  }, [state]);

  function setActiveTab(tabId: MobileTabId): void {
    startTransition(() => {
      dispatch({
        type: "set-active-tab",
        tabId,
      });
    });
  }

  function setSearchQuery(value: string): void {
    dispatch({
      type: "set-search-query",
      value,
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
