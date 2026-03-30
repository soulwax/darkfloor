import { STORAGE_KEYS } from "@starchild/config/storage";
import { VISUALIZER_TYPES } from "@starchild/config/visualizer";
import { DEFAULT_SPOTIFY_FEATURE_SETTINGS } from "@starchild/types/spotifySettings";

import { MOBILE_DEMO_LIBRARY, MOBILE_NAV_TABS } from "./mobile-shell/data";
import type { MobileShellState } from "./mobile-shell/types";

export type {
  MobileAccentTone,
  MobileArtistSpotlight,
  MobileCollection,
  MobileMetric,
  MobileQuickAction,
  MobileShellSnapshot,
  MobileShellState,
  MobileTabDefinition,
  MobileTabId,
} from "./mobile-shell/types";

export { MOBILE_DEMO_LIBRARY, MOBILE_NAV_TABS } from "./mobile-shell/data";

export const MOBILE_SHELL_INFO = {
  app: "@starchild/mobile",
  status: "react-native-web",
  sharedStorageKeys: {
    volume: STORAGE_KEYS.VOLUME,
    queueState: STORAGE_KEYS.QUEUE_STATE,
    currentTrack: STORAGE_KEYS.CURRENT_TRACK,
  },
  spotifyFeatureDefaults: DEFAULT_SPOTIFY_FEATURE_SETTINGS,
  supportedVisualizerTypes: VISUALIZER_TYPES,
} as const;

export function createInitialMobileShellState(): MobileShellState {
  return {
    activeTab: MOBILE_NAV_TABS[0].id,
    currentTrack: MOBILE_DEMO_LIBRARY.nowPlaying.track,
    queueLength: MOBILE_DEMO_LIBRARY.upNext.length + 1,
    repeatMode: MOBILE_DEMO_LIBRARY.repeatMode,
    searchQuery: "",
  };
}
