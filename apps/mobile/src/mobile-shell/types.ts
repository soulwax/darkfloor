import type { QueuedTrack, RepeatMode, Track } from "@starchild/player-core";

export type MobileTabId = "home" | "discover" | "library" | "search";

export type MobileAccentTone = "mint" | "blue" | "coral" | "gold";

export interface MobileTabDefinition {
  id: MobileTabId;
  label: string;
  caption: string;
}

export interface MobileQuickAction {
  id: string;
  label: string;
  description: string;
  value: string;
  tone: MobileAccentTone;
}

export interface MobileMetric {
  label: string;
  value: string;
  hint: string;
}

export interface MobileCollection {
  id: string;
  title: string;
  subtitle: string;
  curator: string;
  trackCount: number;
  tone: MobileAccentTone;
}

export interface MobileArtistSpotlight {
  id: number;
  name: string;
  summary: string;
  listenerLabel: string;
  tone: MobileAccentTone;
}

export interface MobileShellSnapshot {
  nowPlaying: QueuedTrack;
  upNext: QueuedTrack[];
  recentTracks: Track[];
  recommendedTracks: Track[];
  favoriteTracks: Track[];
  collections: MobileCollection[];
  quickActions: MobileQuickAction[];
  metrics: MobileMetric[];
  artists: MobileArtistSpotlight[];
  repeatMode: RepeatMode;
  searchPrompts: string[];
}

export interface MobileShellState {
  activeTab: MobileTabId;
  currentTrack: Track | null;
  queueLength: number;
  repeatMode: RepeatMode;
  searchQuery: string;
}
