import type { Album, Artist } from "@starchild/types";
import type { QueuedTrack, Track } from "@starchild/player-core";

import type {
  MobileArtistSpotlight,
  MobileCollection,
  MobileMetric,
  MobileQuickAction,
  MobileShellSnapshot,
  MobileTabDefinition,
} from "./types";

function createArtist(id: number, name: string): Artist {
  return {
    id,
    name,
    link: `https://darkfloor.invalid/artist/${id}`,
    picture: `https://darkfloor.invalid/artist/${id}/cover`,
    picture_small: `https://darkfloor.invalid/artist/${id}/cover-small`,
    picture_medium: `https://darkfloor.invalid/artist/${id}/cover-medium`,
    picture_big: `https://darkfloor.invalid/artist/${id}/cover-big`,
    picture_xl: `https://darkfloor.invalid/artist/${id}/cover-xl`,
    tracklist: `https://darkfloor.invalid/artist/${id}/tracks`,
    type: "artist",
  };
}

function createAlbum(
  id: number,
  title: string,
  md5Image: string,
  artist: Artist,
): Album {
  return {
    id,
    title,
    cover: `https://darkfloor.invalid/album/${id}/cover`,
    cover_small: `https://darkfloor.invalid/album/${id}/cover-small`,
    cover_medium: `https://darkfloor.invalid/album/${id}/cover-medium`,
    cover_big: `https://darkfloor.invalid/album/${id}/cover-big`,
    cover_xl: `https://darkfloor.invalid/album/${id}/cover-xl`,
    md5_image: md5Image,
    tracklist: `https://darkfloor.invalid/album/${id}/tracks`,
    type: "album",
    release_date: "2026-03-30",
    artist,
  };
}

function createTrack(input: {
  id: number;
  title: string;
  duration: number;
  artist: Artist;
  album: Album;
  bpm: number;
  rank: number;
  preview: string;
  releaseDate: string;
}): Track {
  return {
    id: input.id,
    readable: true,
    title: input.title,
    title_short: input.title,
    link: `https://darkfloor.invalid/track/${input.id}`,
    duration: input.duration,
    rank: input.rank,
    explicit_lyrics: false,
    explicit_content_lyrics: 0,
    explicit_content_cover: 0,
    preview: input.preview,
    md5_image: input.album.md5_image,
    artist: input.artist,
    album: input.album,
    type: "track",
    bpm: input.bpm,
    gain: -7.1,
    release_date: input.releaseDate,
    deezer_id: input.id,
  };
}

function createQueuedTrack(
  track: Track,
  index: number,
  queueSource: QueuedTrack["queueSource"],
): QueuedTrack {
  return {
    track,
    queueSource,
    addedAt: new Date(Date.UTC(2026, 2, 30, 18, index * 3, 0)),
    queueId: `mobile-queue-${track.id}`,
    addedBy: "mobile-shell",
  };
}

const artists = {
  ayaVale: createArtist(101, "Aya Vale"),
  circuitBloom: createArtist(102, "Circuit Bloom"),
  midnightTape: createArtist(103, "Midnight Tape"),
  paperSatellites: createArtist(104, "Paper Satellites"),
  glassHarbor: createArtist(105, "Glass Harbor"),
  softStatic: createArtist(106, "Soft Static"),
} as const;

const albums = {
  neonTides: createAlbum(201, "Neon Tides", "neon-tides", artists.ayaVale),
  signalHeart: createAlbum(
    202,
    "Signal Heart",
    "signal-heart",
    artists.circuitBloom,
  ),
  afterHours: createAlbum(
    203,
    "After Hours Archive",
    "after-hours-archive",
    artists.midnightTape,
  ),
  cloudManual: createAlbum(
    204,
    "Cloud Manual",
    "cloud-manual",
    artists.paperSatellites,
  ),
  shorelineDrive: createAlbum(
    205,
    "Shoreline Drive",
    "shoreline-drive",
    artists.glassHarbor,
  ),
  paleMachines: createAlbum(
    206,
    "Pale Machines",
    "pale-machines",
    artists.softStatic,
  ),
} as const;

const demoTracks: readonly Track[] = [
  createTrack({
    id: 301,
    title: "Night Transit",
    duration: 214,
    artist: artists.ayaVale,
    album: albums.neonTides,
    bpm: 122,
    rank: 942_000,
    preview: "https://darkfloor.invalid/preview/301.mp3",
    releaseDate: "2026-03-02",
  }),
  createTrack({
    id: 302,
    title: "Cinder Signal",
    duration: 188,
    artist: artists.circuitBloom,
    album: albums.signalHeart,
    bpm: 128,
    rank: 886_000,
    preview: "https://darkfloor.invalid/preview/302.mp3",
    releaseDate: "2026-02-18",
  }),
  createTrack({
    id: 303,
    title: "Late Lobby",
    duration: 244,
    artist: artists.midnightTape,
    album: albums.afterHours,
    bpm: 110,
    rank: 731_000,
    preview: "https://darkfloor.invalid/preview/303.mp3",
    releaseDate: "2026-01-29",
  }),
  createTrack({
    id: 304,
    title: "Runway Echo",
    duration: 201,
    artist: artists.paperSatellites,
    album: albums.cloudManual,
    bpm: 124,
    rank: 673_000,
    preview: "https://darkfloor.invalid/preview/304.mp3",
    releaseDate: "2026-03-11",
  }),
  createTrack({
    id: 305,
    title: "Harborline",
    duration: 231,
    artist: artists.glassHarbor,
    album: albums.shorelineDrive,
    bpm: 118,
    rank: 812_000,
    preview: "https://darkfloor.invalid/preview/305.mp3",
    releaseDate: "2026-02-07",
  }),
  createTrack({
    id: 306,
    title: "Soft Voltage",
    duration: 196,
    artist: artists.softStatic,
    album: albums.paleMachines,
    bpm: 126,
    rank: 795_000,
    preview: "https://darkfloor.invalid/preview/306.mp3",
    releaseDate: "2026-03-20",
  }),
  createTrack({
    id: 307,
    title: "Blue Exit Sign",
    duration: 220,
    artist: artists.ayaVale,
    album: albums.neonTides,
    bpm: 120,
    rank: 704_000,
    preview: "https://darkfloor.invalid/preview/307.mp3",
    releaseDate: "2026-03-24",
  }),
] as const;

const demoQueue = [
  createQueuedTrack(demoTracks[0], 0, "user"),
  createQueuedTrack(demoTracks[1], 1, "user"),
  createQueuedTrack(demoTracks[2], 2, "playlist"),
  createQueuedTrack(demoTracks[3], 3, "recommendation"),
  createQueuedTrack(demoTracks[4], 4, "smart"),
] as const;

const quickActions: readonly MobileQuickAction[] = [
  {
    id: "queue",
    label: "Queue sync",
    description: "Carry the same order into desktop and web sessions.",
    value: "5 tracks ready",
    tone: "mint",
  },
  {
    id: "offline",
    label: "Offline prep",
    description: "Pin the next commute mix before native downloads land.",
    value: "12 songs staged",
    tone: "blue",
  },
  {
    id: "visualizer",
    label: "Visualizer handoff",
    description: "Reuse the same flowfield and kaleidoscope presets later.",
    value: "2 shared modes",
    tone: "coral",
  },
  {
    id: "session",
    label: "Session resume",
    description: "Restore the last track, time, and repeat mode on launch.",
    value: "Repeat all",
    tone: "gold",
  },
] as const;

const metrics: readonly MobileMetric[] = [
  {
    label: "Queue depth",
    value: "05",
    hint: "Now playing plus four more up next.",
  },
  {
    label: "Favorites",
    value: "18",
    hint: "Pinned for the next saved-library pass.",
  },
  {
    label: "Shared contracts",
    value: "03",
    hint: "Queue, storage, and visualizer wiring already align.",
  },
] as const;

const collections: readonly MobileCollection[] = [
  {
    id: "late-shift",
    title: "Late Shift",
    subtitle: "Glossy synth pop for after midnight.",
    curator: "Curated from recent likes",
    trackCount: 24,
    tone: "blue",
  },
  {
    id: "platform-test",
    title: "Platform Test Mix",
    subtitle: "A tight set for playback, queue, and progress QA.",
    curator: "Built for mobile shell validation",
    trackCount: 12,
    tone: "mint",
  },
  {
    id: "shoreline-drive",
    title: "Coastal Motion",
    subtitle: "Warm, forward tracks for commute listening.",
    curator: "Imported from shared recommendations",
    trackCount: 31,
    tone: "coral",
  },
] as const;

const artistSpotlights: readonly MobileArtistSpotlight[] = [
  {
    id: artists.ayaVale.id,
    name: artists.ayaVale.name,
    summary: "Perfect for fans of airy hooks with firm low-end rhythm.",
    listenerLabel: "Trending in your night mix",
    tone: "mint",
  },
  {
    id: artists.circuitBloom.id,
    name: artists.circuitBloom.name,
    summary: "Clean electronic percussion that suits mobile sessions well.",
    listenerLabel: "Best match for queue expansion",
    tone: "gold",
  },
  {
    id: artists.glassHarbor.id,
    name: artists.glassHarbor.name,
    summary: "Softer energy for saves, background play, and favorites.",
    listenerLabel: "Likely next favorite",
    tone: "blue",
  },
] as const;

export const MOBILE_NAV_TABS: readonly MobileTabDefinition[] = [
  {
    id: "home",
    label: "Home",
    caption: "Session",
  },
  {
    id: "discover",
    label: "Discover",
    caption: "Fresh",
  },
  {
    id: "library",
    label: "Library",
    caption: "Saved",
  },
  {
    id: "search",
    label: "Search",
    caption: "Find",
  },
] as const;

export const MOBILE_DEMO_LIBRARY: MobileShellSnapshot = {
  nowPlaying: demoQueue[0],
  upNext: demoQueue.slice(1),
  recentTracks: [demoTracks[2], demoTracks[4], demoTracks[6], demoTracks[1]],
  recommendedTracks: [demoTracks[5], demoTracks[3], demoTracks[4], demoTracks[1]],
  favoriteTracks: [demoTracks[0], demoTracks[6], demoTracks[5], demoTracks[2]],
  collections: [...collections],
  quickActions: [...quickActions],
  metrics: [...metrics],
  artists: [...artistSpotlights],
  repeatMode: "all",
  searchPrompts: [
    "Search a song title",
    "Find an artist you already like",
    "Open the same queue on another runtime",
  ],
};
