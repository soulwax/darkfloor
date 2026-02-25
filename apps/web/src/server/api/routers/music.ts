// File: apps/web/src/server/api/routers/music.ts

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { ENABLE_AUDIO_FEATURES } from "@/config/features";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import type { db } from "@/server/db";
import {
  audioFeatures,
  favorites,
  listeningAnalytics,
  listeningHistory,
  playbackState,
  playerSessions,
  playlistTracks,
  playlists,
  recommendationCache,
  recommendationLogs,
  searchHistory,
  userTasteProfiles,
  userPreferences,
  users,
} from "@/server/db/schema";
import {
  fetchDeezerRecommendations,
  fetchEnhancedRecommendations,
  fetchHybridRecommendations,
  fetchMultiSeedRecommendations,
  filterRecommendations,
  getCacheExpiryDate,
  shuffleWithDiversity,
} from "@/server/services/recommendations";
import { bluesix } from "@/services/bluesix";
import { isTrack, type Track } from "@starchild/types";

const trackSchema = z.object({
  id: z.number(),
  readable: z.boolean(),
  title: z.string(),
  title_short: z.string(),
  title_version: z.string().optional(),
  link: z.string(),
  duration: z.number(),
  rank: z.number(),
  explicit_lyrics: z.boolean(),
  explicit_content_lyrics: z.number(),
  explicit_content_cover: z.number(),
  preview: z.string(),
  md5_image: z.string(),
  artist: z.object({
    id: z.number(),
    name: z.string(),
    link: z.string().optional(),
    picture: z.string().optional(),
    picture_small: z.string().optional(),
    picture_medium: z.string().optional(),
    picture_big: z.string().optional(),
    picture_xl: z.string().optional(),
    tracklist: z.string().optional(),
    type: z.literal("artist"),
  }),
  album: z.object({
    id: z.number(),
    title: z.string(),
    cover: z.string(),
    cover_small: z.string(),
    cover_medium: z.string(),
    cover_big: z.string(),
    cover_xl: z.string(),
    md5_image: z.string(),
    tracklist: z.string(),
    type: z.literal("album"),
  }),
  type: z.literal("track"),
  deezer_id: z.union([z.number(), z.string()]).optional(),
  spotify_id: z.string().optional(),
});

type SpiceUpTrack = {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  deezerId?: unknown;
  deezer_id?: unknown;
  explicit?: boolean;
  isrc?: string;
  source?: "spotify" | "lastfm" | "deezer";
  reason?: string;
  score?: number;
};

type SpiceUpResponse = {
  tracks?: SpiceUpTrack[];
  recommendations?: SpiceUpTrack[];
  requestId?: string;
  warnings?: string[];
  mode?: string;
  inputSongs?: number;
  foundSongs?: number;
  seeds?: unknown;
  songResults?: unknown;
  seedQuality?: unknown;
};

function getDeezerId(track: z.infer<typeof trackSchema>): number | undefined {
  if (track.deezer_id !== undefined) {
    return typeof track.deezer_id === "string"
      ? parseInt(track.deezer_id, 10) || undefined
      : track.deezer_id;
  }
  return undefined;
}

type PostgresConstraintError = {
  code?: string;
  constraint?: string;
};

function isUniqueConstraintError(
  error: unknown,
  constraint?: string,
): error is PostgresConstraintError {
  if (!error || typeof error !== "object") return false;

  const candidate = error as PostgresConstraintError;
  if (candidate.code !== "23505") return false;
  if (!constraint) return true;

  return candidate.constraint === constraint;
}

async function syncPlaylistTrackIdSequence(database: typeof db): Promise<void> {
  await database.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"hexmusic-stream_playlist_track"', 'id'),
      COALESCE((SELECT MAX("id") FROM "hexmusic-stream_playlist_track"), 0) + 1,
      false
    )
  `);
}

async function syncListeningHistoryIdSequence(
  database: typeof db,
): Promise<void> {
  await database.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"hexmusic-stream_listening_history"', 'id'),
      COALESCE((SELECT MAX("id") FROM "hexmusic-stream_listening_history"), 0) + 1,
      false
    )
  `);
}

function normalizeDeezerId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeDeezerId(record.deezerId ?? record.deezer_id ?? record.id);
  }
  return null;
}

function extractSpiceUpTracks(payload: unknown): SpiceUpTrack[] {
  if (Array.isArray(payload)) {
    return payload as SpiceUpTrack[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const tracks = record.tracks ?? record.recommendations;

  return Array.isArray(tracks) ? (tracks as SpiceUpTrack[]) : [];
}

function normalizeTasteStrings(
  values: string[] | undefined,
  maxItems: number,
): string[] {
  if (!values || values.length === 0) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const normalizedKey = trimmed.toLowerCase();
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    normalized.push(trimmed);

    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

type WeightedTasteItem = {
  label: string;
  score: number;
  count: number;
  lastSeenAt: Date | null;
};

type GenreCatalogItem = {
  id: number;
  name: string;
  normalizedName: string;
  tokens: string[];
};

type StoredTasteProfile = typeof userTasteProfiles.$inferSelect;

type InferredTasteProfile = {
  preferredGenreId: number | null;
  preferredGenreName: string | null;
  seedArtists: string[];
  seedPlaylistTitles: string[];
  genreConfidence: number;
  sampleSizes: {
    analytics: number;
    favorites: number;
    searches: number;
  };
};

const TASTE_MAX_SEEDS = 24;
const TASTE_MIN_SEED_SCORE = 0.5;
const TASTE_GENRE_CONFIDENCE_THRESHOLD = 0.58;
const TASTE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "mix",
  "of",
  "on",
  "playlist",
  "radio",
  "song",
  "songs",
  "the",
  "to",
  "tracks",
  "with",
]);
const GENRE_ALIAS_MAP = new Map<string, string>([
  ["hiphop", "hip hop"],
  ["hip-hop", "hip hop"],
  ["rnb", "r&b"],
  ["r and b", "r&b"],
  ["drum and bass", "drum & bass"],
  ["dnb", "drum & bass"],
  ["edm", "electronic"],
  ["electronica", "electronic"],
]);
const GENRE_CACHE_TTL_MS = 1000 * 60 * 30;
let genreCatalogCache: {
  expiresAt: number;
  items: GenreCatalogItem[];
} | null = null;

function normalizeTasteLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeGenreLabel(value: string): string {
  const normalized = normalizeTasteLabel(value);
  return GENRE_ALIAS_MAP.get(normalized) ?? normalized;
}

function tokenizeTasteText(value: string): string[] {
  const normalized = canonicalizeGenreLabel(value);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !TASTE_STOP_WORDS.has(token));
}

function buildTokenPhrases(tokens: string[]): Set<string> {
  const phrases = new Set<string>();
  for (const token of tokens) {
    phrases.add(token);
  }

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (first && second) {
      phrases.add(`${first} ${second}`);
    }
  }

  for (let i = 0; i < tokens.length - 2; i += 1) {
    const first = tokens[i];
    const second = tokens[i + 1];
    const third = tokens[i + 2];
    if (first && second && third) {
      phrases.add(`${first} ${second} ${third}`);
    }
  }

  return phrases;
}

function recencyWeight(
  timestamp: Date | null,
  now: Date,
  halfLifeDays: number,
  floor: number,
): number {
  if (!timestamp) return floor;
  const ageDays = Math.max(
    0,
    (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24),
  );
  const decay = Math.exp(-ageDays / halfLifeDays);
  return floor + (1 - floor) * decay;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function addWeightedTasteItem(
  map: Map<string, WeightedTasteItem>,
  label: string | null | undefined,
  score: number,
  lastSeenAt: Date | null = null,
) {
  if (!label) return;
  const trimmed = label.trim();
  if (!trimmed) return;
  if (!Number.isFinite(score) || score <= 0) return;

  const key = normalizeTasteLabel(trimmed);
  if (!key || TASTE_STOP_WORDS.has(key)) return;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      label: trimmed,
      score,
      count: 1,
      lastSeenAt,
    });
    return;
  }

  existing.score += score;
  existing.count += 1;
  if (
    lastSeenAt &&
    (!existing.lastSeenAt || lastSeenAt > existing.lastSeenAt)
  ) {
    existing.lastSeenAt = lastSeenAt;
  }
}

function topWeightedTasteItems(
  map: Map<string, WeightedTasteItem>,
  limit: number,
  minScore = TASTE_MIN_SEED_SCORE,
): string[] {
  return Array.from(map.values())
    .filter((item) => item.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.count !== a.count) return b.count - a.count;
      if (a.lastSeenAt && b.lastSeenAt) {
        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
      }
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit)
    .map((item) => item.label);
}

function readTrackArtistName(trackData: unknown): string | null {
  if (!trackData || typeof trackData !== "object") return null;
  const record = trackData as Record<string, unknown>;
  const artist = record.artist;
  if (!artist || typeof artist !== "object") return null;
  const name = (artist as Record<string, unknown>).name;
  return typeof name === "string" ? name.trim() : null;
}

function readTrackAlbumTitle(trackData: unknown): string | null {
  if (!trackData || typeof trackData !== "object") return null;
  const record = trackData as Record<string, unknown>;
  const album = record.album;
  if (!album || typeof album !== "object") return null;
  const title = (album as Record<string, unknown>).title;
  return typeof title === "string" ? title.trim() : null;
}

function readTrackTitle(trackData: unknown): string | null {
  if (!trackData || typeof trackData !== "object") return null;
  const title = (trackData as Record<string, unknown>).title;
  return typeof title === "string" ? title.trim() : null;
}

async function loadGenreCatalog(): Promise<GenreCatalogItem[]> {
  const now = Date.now();
  if (genreCatalogCache && genreCatalogCache.expiresAt > now) {
    return genreCatalogCache.items;
  }

  try {
    const payload = await bluesix.request<unknown>("/api/music/genres");
    const payloadRecord =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    const rows = Array.isArray(payloadRecord?.data)
      ? payloadRecord.data
      : Array.isArray(payload)
        ? payload
        : [];

    const genres = rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const record = row as Record<string, unknown>;
        const rawId = record.id;
        const rawName = record.name;
        if (typeof rawName !== "string" || !rawName.trim()) return null;
        const id =
          typeof rawId === "number"
            ? rawId
            : typeof rawId === "string"
              ? Number.parseInt(rawId, 10)
              : NaN;
        if (!Number.isFinite(id) || id <= 0) return null;
        const name = rawName.trim();
        const normalizedName = canonicalizeGenreLabel(name);
        const tokens = tokenizeTasteText(name);
        return {
          id,
          name,
          normalizedName,
          tokens,
        } satisfies GenreCatalogItem;
      })
      .filter((genre): genre is GenreCatalogItem => !!genre);

    if (genres.length > 0) {
      genreCatalogCache = {
        expiresAt: now + GENRE_CACHE_TTL_MS,
        items: genres,
      };
    }

    return genres;
  } catch (error) {
    console.warn("[TasteProfile] Failed to load genre catalog:", error);
    return genreCatalogCache?.items ?? [];
  }
}

function scoreGenresFromText(
  text: string,
  weight: number,
  genres: GenreCatalogItem[],
  genreScores: Map<number, number>,
) {
  if (!text || !Number.isFinite(weight) || weight <= 0) return;
  const tokens = tokenizeTasteText(text);
  if (tokens.length === 0) return;

  const tokenSet = new Set(tokens);
  const tokenPhrases = buildTokenPhrases(tokens);

  for (const genre of genres) {
    if (!genre.normalizedName) continue;

    let scoreDelta = 0;
    if (tokenPhrases.has(genre.normalizedName)) {
      scoreDelta = weight * 2.8;
    } else {
      const overlap = genre.tokens.reduce((count, token) => {
        return count + (tokenSet.has(token) ? 1 : 0);
      }, 0);

      if (overlap === genre.tokens.length && overlap > 0) {
        scoreDelta = weight * 1.6;
      } else if (overlap > 0 && genre.tokens.length > 1) {
        scoreDelta = weight * (overlap / genre.tokens.length);
      } else if (
        overlap === 1 &&
        genre.tokens.length === 1 &&
        genre.tokens[0] &&
        genre.tokens[0].length >= 4
      ) {
        scoreDelta = weight * 0.5;
      }
    }

    if (scoreDelta > 0) {
      genreScores.set(genre.id, (genreScores.get(genre.id) ?? 0) + scoreDelta);
    }
  }
}

function mergeTasteProfileSignals(
  userId: string,
  stored: StoredTasteProfile | null,
  inferred: InferredTasteProfile,
) {
  const storedHasGenre = Boolean(
    (stored?.preferredGenreId !== null &&
      stored?.preferredGenreId !== undefined) ||
    (stored?.preferredGenreName ?? "").trim().length > 0,
  );
  const inferredHasGenre = Boolean(
    (inferred.preferredGenreId !== null &&
      inferred.preferredGenreId !== undefined) ||
    (inferred.preferredGenreName ?? "").trim().length > 0,
  );

  let preferredGenreId = stored?.preferredGenreId ?? null;
  let preferredGenreName = stored?.preferredGenreName ?? null;

  if (
    inferredHasGenre &&
    (!storedHasGenre ||
      inferred.genreConfidence >= TASTE_GENRE_CONFIDENCE_THRESHOLD)
  ) {
    preferredGenreId = inferred.preferredGenreId;
    preferredGenreName = inferred.preferredGenreName;
  }

  const seedArtists = normalizeTasteStrings(
    [...inferred.seedArtists, ...(stored?.seedArtists ?? [])],
    TASTE_MAX_SEEDS,
  );
  const seedPlaylistTitles = normalizeTasteStrings(
    [...inferred.seedPlaylistTitles, ...(stored?.seedPlaylistTitles ?? [])],
    TASTE_MAX_SEEDS,
  );

  return {
    id: stored?.id ?? null,
    userId,
    preferredGenreId,
    preferredGenreName,
    seedArtists,
    seedPlaylistTitles,
    createdAt: stored?.createdAt ?? null,
    updatedAt: stored?.updatedAt ?? null,
    inference: {
      version: 2,
      genreConfidence: inferred.genreConfidence,
      sampleSizes: inferred.sampleSizes,
    },
  };
}

async function inferTasteProfileFromBehavior(
  database: typeof db,
  userId: string,
  stored: StoredTasteProfile | null,
): Promise<InferredTasteProfile> {
  const now = new Date();

  const [analyticsRows, favoriteRows, searchRows] = await Promise.all([
    database
      .select({
        trackId: listeningAnalytics.trackId,
        trackData: listeningAnalytics.trackData,
        playedAt: listeningAnalytics.playedAt,
        completionPercentage: listeningAnalytics.completionPercentage,
        skipped: listeningAnalytics.skipped,
        playContext: listeningAnalytics.playContext,
        contextId: listeningAnalytics.contextId,
      })
      .from(listeningAnalytics)
      .where(eq(listeningAnalytics.userId, userId))
      .orderBy(desc(listeningAnalytics.playedAt))
      .limit(900),
    database
      .select({
        trackId: favorites.trackId,
        trackData: favorites.trackData,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt))
      .limit(250),
    database
      .select({
        query: searchHistory.query,
        searchedAt: searchHistory.searchedAt,
      })
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.searchedAt))
      .limit(180),
  ]);

  const playlistContextCounts = new Map<number, number>();
  const playlistContextIds = new Set<number>();
  for (const row of analyticsRows) {
    if (row.playContext !== "playlist") continue;
    if (typeof row.contextId !== "number" || row.contextId <= 0) continue;
    playlistContextIds.add(row.contextId);
    playlistContextCounts.set(
      row.contextId,
      (playlistContextCounts.get(row.contextId) ?? 0) + 1,
    );
  }

  const playlistContextNames =
    playlistContextIds.size > 0
      ? await database
          .select({
            id: playlists.id,
            name: playlists.name,
          })
          .from(playlists)
          .where(
            and(
              eq(playlists.userId, userId),
              inArray(
                playlists.id,
                Array.from(playlistContextIds).slice(0, 120),
              ),
            ),
          )
      : [];

  const playCountByTrackId = new Map<number, number>();
  for (const row of analyticsRows) {
    const existing = playCountByTrackId.get(row.trackId) ?? 0;
    playCountByTrackId.set(row.trackId, existing + 1);
  }

  const artistScores = new Map<string, WeightedTasteItem>();
  const titleScores = new Map<string, WeightedTasteItem>();

  for (const row of analyticsRows) {
    const artistName = readTrackArtistName(row.trackData);
    const albumTitle = readTrackAlbumTitle(row.trackData);
    const trackTitle = readTrackTitle(row.trackData);
    const completion = clamp01((row.completionPercentage ?? 0) / 100);
    const recency = recencyWeight(row.playedAt, now, 42, 0.22);
    const repeatCount = playCountByTrackId.get(row.trackId) ?? 1;
    const repeatBoost = 1 + Math.min(0.55, Math.log1p(repeatCount) / 3.4);
    const contextBoost =
      row.playContext === "favorites"
        ? 0.25
        : row.playContext === "playlist"
          ? 0.16
          : row.playContext === "album"
            ? 0.12
            : row.playContext === "artist"
              ? 0.1
              : 0.06;
    const engagement = row.skipped
      ? 0.18 + completion * 0.22
      : 0.48 + completion * 0.88;
    const score = engagement * recency * repeatBoost + contextBoost;

    addWeightedTasteItem(artistScores, artistName, score * 1.35, row.playedAt);
    addWeightedTasteItem(titleScores, albumTitle, score * 1.0, row.playedAt);

    if (row.playContext === "search") {
      addWeightedTasteItem(titleScores, trackTitle, score * 0.55, row.playedAt);
    }
  }

  for (const row of favoriteRows) {
    const artistName = readTrackArtistName(row.trackData);
    const albumTitle = readTrackAlbumTitle(row.trackData);
    const recency = recencyWeight(row.createdAt, now, 120, 0.45);
    const score = 2.1 + recency;

    addWeightedTasteItem(artistScores, artistName, score * 1.45, row.createdAt);
    addWeightedTasteItem(titleScores, albumTitle, score * 1.15, row.createdAt);
  }

  for (const row of searchRows) {
    const query = row.query.trim();
    if (!query) continue;
    const tokenCount = tokenizeTasteText(query).length;
    if (tokenCount === 0 || tokenCount > 6) continue;

    const recency = recencyWeight(row.searchedAt, now, 40, 0.24);
    const score = recency * (tokenCount <= 3 ? 1.2 : 0.85);
    addWeightedTasteItem(titleScores, query, score, row.searchedAt);
  }

  for (const playlist of playlistContextNames) {
    const playCount = playlistContextCounts.get(playlist.id) ?? 0;
    if (playCount <= 0) continue;
    const score = Math.min(2.4, playCount * 0.33);
    addWeightedTasteItem(titleScores, playlist.name, score);
  }

  for (const artist of stored?.seedArtists ?? []) {
    addWeightedTasteItem(artistScores, artist, 0.75, stored?.updatedAt ?? null);
  }
  for (const title of stored?.seedPlaylistTitles ?? []) {
    addWeightedTasteItem(titleScores, title, 0.65, stored?.updatedAt ?? null);
  }

  const seedArtists = topWeightedTasteItems(artistScores, TASTE_MAX_SEEDS);
  const seedPlaylistTitles = topWeightedTasteItems(
    titleScores,
    TASTE_MAX_SEEDS,
  );

  const genres = await loadGenreCatalog();
  const genreScores = new Map<number, number>();

  if (stored?.preferredGenreId) {
    genreScores.set(stored.preferredGenreId, 2.4);
  }
  if (stored?.preferredGenreName) {
    scoreGenresFromText(stored.preferredGenreName, 1.6, genres, genreScores);
  }

  for (let i = 0; i < searchRows.length; i += 1) {
    const row = searchRows[i];
    if (!row) continue;
    const query = row.query.trim();
    if (!query) continue;
    const tokens = tokenizeTasteText(query);
    if (tokens.length === 0 || tokens.length > 8) continue;

    const recency = recencyWeight(row.searchedAt, now, 40, 0.22);
    const positionalWeight = 1 - Math.min(0.55, i * 0.015);
    scoreGenresFromText(
      query,
      recency * positionalWeight * 1.7,
      genres,
      genreScores,
    );
  }

  for (let i = 0; i < seedPlaylistTitles.length; i += 1) {
    const title = seedPlaylistTitles[i];
    if (!title) continue;
    const positionalWeight = 1 - Math.min(0.65, i * 0.05);
    scoreGenresFromText(title, positionalWeight, genres, genreScores);
  }

  const rankedGenres = Array.from(genreScores.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const topGenre = rankedGenres[0];
  const secondGenre = rankedGenres[1];
  const topGenreScore = topGenre?.[1] ?? 0;
  const secondGenreScore = secondGenre?.[1] ?? 0;
  const genreConfidence = clamp01(
    topGenreScore / (topGenreScore + secondGenreScore + 0.9),
  );
  const topGenreRecord = topGenre ? genreById.get(topGenre[0]) : null;
  const minimumGenreScore = 1.85;
  const hasReliableGenre =
    !!topGenreRecord &&
    (topGenreScore >= minimumGenreScore ||
      genreConfidence >= TASTE_GENRE_CONFIDENCE_THRESHOLD);

  return {
    preferredGenreId: hasReliableGenre ? topGenreRecord.id : null,
    preferredGenreName: hasReliableGenre ? topGenreRecord.name : null,
    seedArtists,
    seedPlaylistTitles,
    genreConfidence,
    sampleSizes: {
      analytics: analyticsRows.length,
      favorites: favoriteRows.length,
      searches: searchRows.length,
    },
  };
}

async function fetchTracksByDeezerIds(
  ids: number[],
  options?: {
    excludeTrackIds?: number[];
    maxExplicit?: boolean;
  },
): Promise<Track[]> {
  const uniqueIds = Array.from(new Set(ids)).filter((id) =>
    Number.isFinite(id),
  );
  if (uniqueIds.length === 0) return [];

  const params = new URLSearchParams();
  params.set("ids", uniqueIds.join(","));
  const tracksResponse = await bluesix.request<unknown>(
    `/music/tracks/batch?${params.toString()}`,
  );
  const tracks = Array.isArray(tracksResponse)
    ? tracksResponse.filter((item): item is Track => isTrack(item))
    : [];

  const hydratedTracks = tracks.map((track) => ({
    ...track,
    deezer_id: track.deezer_id ?? track.id,
  }));

  const filtered = options
    ? filterRecommendations(hydratedTracks, {
        excludeTrackIds: options.excludeTrackIds,
        maxExplicit: options.maxExplicit,
      })
    : hydratedTracks;

  const trackMap = new Map(filtered.map((track) => [track.id, track]));
  const ordered = uniqueIds
    .map((id) => trackMap.get(id))
    .filter((track): track is Track => Boolean(track));

  return ordered.length > 0 ? ordered : filtered;
}

async function convertToDeezerIds(
  tracks: Array<{ name: string; artist?: string }>,
): Promise<number[]> {
  if (tracks.length === 0) return [];
  const conversionResponse = await bluesix.request<{
    tracks?: Array<{ deezerId?: unknown }>;
  }>("/api/music/tracks/convert", {
    method: "POST",
    body: JSON.stringify({
      tracks: tracks.map((track) => ({
        name: track.name,
        artist: track.artist,
      })),
    }),
  });

  return Array.from(
    new Set(
      (conversionResponse.tracks ?? [])
        .map((track) => normalizeDeezerId(track.deezerId))
        .filter((id): id is number => typeof id === "number"),
    ),
  );
}

async function resolveSpiceUpTracksToDeezer(
  spiceTracks: SpiceUpTrack[],
): Promise<Track[]> {
  const orderedIds: number[] = [];
  const seenIds = new Set<number>();
  const spotifyIdByDeezerId = new Map<number, string>();
  const missingCandidates: Array<{
    name: string;
    artist?: string;
    spotifyId?: string;
  }> = [];

  for (const track of spiceTracks) {
    const spotifyId =
      typeof track.id === "string" ? track.id.trim() : undefined;
    const deezerId = normalizeDeezerId(track.deezerId ?? track.deezer_id);
    if (deezerId) {
      if (!seenIds.has(deezerId)) {
        seenIds.add(deezerId);
        orderedIds.push(deezerId);
      }
      if (spotifyId) {
        spotifyIdByDeezerId.set(deezerId, spotifyId);
      }
      continue;
    }

    const name = track.name?.trim();
    if (!name) continue;
    const artist = track.artists?.[0]?.name?.trim();
    missingCandidates.push({ name, artist, spotifyId });
  }

  if (missingCandidates.length > 0) {
    const conversionResponse = await bluesix.request<{
      tracks?: Array<{ deezerId?: unknown }>;
    }>("/api/music/tracks/convert", {
      method: "POST",
      body: JSON.stringify({
        tracks: missingCandidates.map((track) => ({
          name: track.name,
          artist: track.artist,
        })),
      }),
    });

    const converted = conversionResponse.tracks ?? [];
    for (let i = 0; i < converted.length; i += 1) {
      const candidate = converted[i];
      const deezerId = normalizeDeezerId(candidate?.deezerId);
      if (!deezerId || seenIds.has(deezerId)) continue;
      seenIds.add(deezerId);
      orderedIds.push(deezerId);
      const spotifyId = missingCandidates[i]?.spotifyId;
      if (spotifyId) {
        spotifyIdByDeezerId.set(deezerId, spotifyId);
      }
    }
  }

  if (orderedIds.length === 0) {
    return [];
  }

  const tracks = await fetchTracksByDeezerIds(orderedIds);
  return tracks.map((track) => {
    const spotifyId = spotifyIdByDeezerId.get(track.id);
    return spotifyId ? { ...track, spotify_id: spotifyId } : track;
  });
}

async function syncAutoFavorites(database: typeof db, userId: string) {
  const topTracks = await database
    .select({
      trackId: listeningAnalytics.trackId,
      trackData: listeningAnalytics.trackData,
      playCount: sql<number>`COUNT(*) FILTER (WHERE ${listeningAnalytics.skipped} = false AND ${listeningAnalytics.completionPercentage} >= 50)`,
    })
    .from(listeningAnalytics)
    .where(eq(listeningAnalytics.userId, userId))
    .groupBy(listeningAnalytics.trackId, listeningAnalytics.trackData)
    .having(
      sql`COUNT(*) FILTER (WHERE ${listeningAnalytics.skipped} = false AND ${listeningAnalytics.completionPercentage} >= 50) >= 3`,
    )
    .orderBy(
      desc(
        sql`COUNT(*) FILTER (WHERE ${listeningAnalytics.skipped} = false AND ${listeningAnalytics.completionPercentage} >= 50)`,
      ),
    )
    .limit(16);

  if (topTracks.length === 0) {
    return;
  }

  const currentFavorites = await database.query.favorites.findMany({
    where: eq(favorites.userId, userId),
  });

  const currentFavoriteTrackIds = new Set(
    currentFavorites.map((f: { trackId: number }) => f.trackId),
  );
  const topTrackIds = new Set(
    topTracks.map((t: { trackId: number }) => t.trackId),
  );

  const toRemove = currentFavorites.filter(
    (f: { trackId: number }) => !topTrackIds.has(f.trackId),
  );
  if (toRemove.length > 0) {
    const trackIdsToRemove = toRemove.map(
      (f: { trackId: number }) => f.trackId,
    );
    await database
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          inArray(favorites.trackId, trackIdsToRemove),
        ),
      );
  }

  const toAdd = topTracks.filter(
    (t: { trackId: number }) => !currentFavoriteTrackIds.has(t.trackId),
  );
  if (toAdd.length > 0) {
    await database.insert(favorites).values(
      toAdd.map((t: { trackId: number; trackData: unknown }) => {
        const track = t.trackData as Track;
        return {
          userId,
          trackId: t.trackId,
          deezerId: getDeezerId(track as z.infer<typeof trackSchema>),
          trackData: track,
        };
      }),
    );
  }
}

export const musicRouter = createTRPCRouter({
  addFavorite: protectedProcedure
    .input(z.object({ track: trackSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.favorites.findFirst({
        where: and(
          eq(favorites.userId, ctx.session.user.id),
          eq(favorites.trackId, input.track.id),
        ),
      });

      if (existing) {
        return { success: true, alreadyExists: true };
      }

      await ctx.db.insert(favorites).values({
        userId: ctx.session.user.id,
        trackId: input.track.id,
        deezerId: getDeezerId(input.track),
        trackData: input.track,
      });

      return { success: true, alreadyExists: false };
    }),

  removeFavorite: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(favorites)
        .where(
          and(
            eq(favorites.userId, ctx.session.user.id),
            eq(favorites.trackId, input.trackId),
          ),
        );

      return { success: true };
    }),

  getFavorites: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.favorites.findMany({
        where: eq(favorites.userId, ctx.session.user.id),
        orderBy: [desc(favorites.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return items.map(
        (item: { id: number; trackData: unknown; createdAt: Date }) => ({
          id: item.id,
          track: item.trackData as Track,
          createdAt: item.createdAt,
        }),
      );
    }),

  isFavorite: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.favorites.findFirst({
        where: and(
          eq(favorites.userId, ctx.session.user.id),
          eq(favorites.trackId, input.trackId),
        ),
      });

      return { isFavorite: !!item };
    }),

  syncAutoFavorites: protectedProcedure.mutation(async ({ ctx }) => {
    await syncAutoFavorites(ctx.db, ctx.session.user.id);
    return { success: true };
  }),

  createPlaylist: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        description: z.string().optional(),
        isPublic: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [playlist] = await ctx.db
        .insert(playlists)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
        })
        .returning();

      return playlist;
    }),

  updatePlaylistVisibility: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isPublic: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.id),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      await ctx.db
        .update(playlists)
        .set({
          isPublic: input.isPublic,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(playlists.id, input.id),
            eq(playlists.userId, ctx.session.user.id),
          ),
        );

      return { success: true, isPublic: input.isPublic };
    }),

  updatePlaylistMetadata: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(256).optional(),
        description: z.string().max(1024).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.id),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      const updateData: Partial<typeof playlists.$inferInsert> = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.description !== undefined) {
        updateData.description =
          input.description.trim().length > 0 ? input.description : null;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      updateData.updatedAt = new Date();

      await ctx.db
        .update(playlists)
        .set(updateData)
        .where(
          and(
            eq(playlists.id, input.id),
            eq(playlists.userId, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  getPlaylists: protectedProcedure.query(async ({ ctx }) => {
    const playlistsResult = await ctx.db.query.playlists.findMany({
      where: eq(playlists.userId, ctx.session.user.id),
      orderBy: [desc(playlists.createdAt)],
      with: {
        tracks: {
          orderBy: [desc(playlistTracks.position)],
          limit: 4,
        },
      },
    });

    type PlaylistWithTracksFromQuery = {
      id: number;
      userId: string;
      name: string;
      description: string | null;
      isPublic: boolean;
      coverImage: string | null;
      createdAt: Date;
      updatedAt: Date | null;
      tracks: Array<{
        id: number;
        trackId: number;
        trackData: unknown;
        playlistId: number;
        position: number;
        addedAt: Date;
      }>;
    };

    const playlistsWithCount = await Promise.all(
      (playlistsResult as PlaylistWithTracksFromQuery[]).map(
        async (playlist) => {
          const totalTracks = await ctx.db.query.playlistTracks.findMany({
            where: eq(playlistTracks.playlistId, playlist.id),
          });

          return {
            ...playlist,
            trackCount: totalTracks.length,
            tracks: playlist.tracks.map((t) => ({
              id: t.id,
              track: t.trackData as Track,
              position: t.position,
              addedAt: t.addedAt,
            })),
          };
        },
      ),
    );

    return playlistsWithCount;
  }),

  getPlaylistsWithTrackStatus: protectedProcedure
    .input(
      z.object({
        trackId: z.number(),
        excludePlaylistId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const playlistsResult = await ctx.db.query.playlists.findMany({
        where: input.excludePlaylistId
          ? and(
              eq(playlists.userId, ctx.session.user.id),
              sql`${playlists.id} != ${input.excludePlaylistId}`,
            )
          : eq(playlists.userId, ctx.session.user.id),
        orderBy: [desc(playlists.createdAt)],
      });

      const playlistsWithStatus = await Promise.all(
        playlistsResult.map(async (playlist) => {
          const trackInPlaylist = await ctx.db.query.playlistTracks.findFirst({
            where: and(
              eq(playlistTracks.playlistId, playlist.id),
              eq(playlistTracks.trackId, input.trackId),
            ),
          });

          const totalTracks = await ctx.db.query.playlistTracks.findMany({
            where: eq(playlistTracks.playlistId, playlist.id),
          });

          return {
            ...playlist,
            trackCount: totalTracks.length,
            hasTrack: !!trackInPlaylist,
          };
        }),
      );

      return playlistsWithStatus;
    }),

  getPlaylist: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.id),
          eq(playlists.userId, ctx.session.user.id),
        ),
        with: {
          tracks: {
            orderBy: [desc(playlistTracks.position)],
          },
        },
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      return {
        ...playlist,
        tracks: playlist.tracks.map(
          (t: {
            id: number;
            trackData: unknown;
            position: number;
            addedAt: Date;
          }) => ({
            id: t.id,
            track: t.trackData as Track,
            position: t.position,
            addedAt: t.addedAt,
          }),
        ),
      };
    }),

  getPublicPlaylist: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(eq(playlists.id, input.id), eq(playlists.isPublic, true)),
        with: {
          tracks: {
            orderBy: [desc(playlistTracks.position)],
          },
        },
      });

      if (!playlist) {
        throw new Error("Playlist not found or not public");
      }

      return {
        ...playlist,
        tracks: playlist.tracks.map(
          (t: {
            id: number;
            trackData: unknown;
            position: number;
            addedAt: Date;
          }) => ({
            id: t.id,
            track: t.trackData as Track,
            position: t.position,
            addedAt: t.addedAt,
          }),
        ),
      };
    }),

  addToPlaylist: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        track: trackSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.playlistId),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      const existing = await ctx.db.query.playlistTracks.findFirst({
        where: and(
          eq(playlistTracks.playlistId, input.playlistId),
          eq(playlistTracks.trackId, input.track.id),
        ),
      });

      if (existing) {
        return { success: true, alreadyExists: true };
      }

      const maxPos = await ctx.db
        .select({ max: sql<number>`max(${playlistTracks.position})` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, input.playlistId));

      const nextPosition = (maxPos[0]?.max ?? -1) + 1;
      const trackEntry = {
        playlistId: input.playlistId,
        trackId: input.track.id,
        deezerId: getDeezerId(input.track),
        trackData: input.track,
        position: nextPosition,
      };

      const insertTrack = async () =>
        ctx.db
          .insert(playlistTracks)
          .values(trackEntry)
          .onConflictDoNothing({
            target: [playlistTracks.playlistId, playlistTracks.trackId],
          })
          .returning({ id: playlistTracks.id });

      let inserted: Array<{ id: number }> = [];

      try {
        inserted = await insertTrack();
      } catch (error) {
        if (
          isUniqueConstraintError(error, "hexmusic-stream_playlist_track_pkey")
        ) {
          await syncPlaylistTrackIdSequence(ctx.db);
          inserted = await insertTrack();
        } else {
          throw error;
        }
      }

      if (inserted.length === 0) {
        return { success: true, alreadyExists: true };
      }

      return { success: true };
    }),

  removeFromPlaylist: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        trackEntryId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.playlistId),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      await ctx.db
        .delete(playlistTracks)
        .where(
          and(
            eq(playlistTracks.id, input.trackEntryId),
            eq(playlistTracks.playlistId, input.playlistId),
          ),
        );

      return { success: true };
    }),

  deletePlaylist: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(playlists)
        .where(
          and(
            eq(playlists.id, input.id),
            eq(playlists.userId, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  reorderPlaylist: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        trackUpdates: z.array(
          z.object({
            trackEntryId: z.number(),
            newPosition: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.playlistId),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new Error("Playlist not found");
      }

      for (const update of input.trackUpdates) {
        await ctx.db
          .update(playlistTracks)
          .set({ position: update.newPosition })
          .where(
            and(
              eq(playlistTracks.id, update.trackEntryId),
              eq(playlistTracks.playlistId, input.playlistId),
            ),
          );
      }

      return { success: true };
    }),

  addToHistory: protectedProcedure
    .input(
      z.object({
        track: trackSchema,
        duration: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const historyEntry = {
        userId: ctx.session.user.id,
        trackId: input.track.id,
        deezerId: getDeezerId(input.track),
        trackData: input.track,
        duration: input.duration,
      };

      const insertHistory = async () =>
        ctx.db.insert(listeningHistory).values(historyEntry);

      try {
        await insertHistory();
      } catch (error) {
        if (
          isUniqueConstraintError(
            error,
            "hexmusic-stream_listening_history_pkey",
          )
        ) {
          await syncListeningHistoryIdSequence(ctx.db);
          await insertHistory();
        } else {
          throw error;
        }
      }

      return { success: true };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.listeningHistory.findMany({
        where: eq(listeningHistory.userId, ctx.session.user.id),
        orderBy: [desc(listeningHistory.playedAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return items.map(
        (item: {
          id: number;
          trackData: unknown;
          playedAt: Date;
          duration: number | null;
        }) => ({
          id: item.id,
          track: item.trackData as Track,
          playedAt: item.playedAt,
          duration: item.duration,
        }),
      );
    }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    const removed = await ctx.db
      .delete(listeningHistory)
      .where(eq(listeningHistory.userId, ctx.session.user.id))
      .returning({ id: listeningHistory.id });

    return { success: true, removedCount: removed.length };
  }),

  clearNonFavoritesFromHistory: protectedProcedure.mutation(async ({ ctx }) => {
    const removed = await ctx.db
      .delete(listeningHistory)
      .where(
        and(
          eq(listeningHistory.userId, ctx.session.user.id),
          sql`NOT EXISTS (
            SELECT 1
            FROM ${favorites}
            WHERE ${favorites.userId} = ${ctx.session.user.id}
              AND ${favorites.trackId} = ${listeningHistory.trackId}
          )`,
        ),
      )
      .returning({ id: listeningHistory.id });

    return { success: true, removedCount: removed.length };
  }),

  removeFromHistory: protectedProcedure
    .input(z.object({ historyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(listeningHistory)
        .where(
          and(
            eq(listeningHistory.userId, ctx.session.user.id),
            eq(listeningHistory.id, input.historyId),
          ),
        );
      return { success: true };
    }),

  removeFromHistoryByTrackId: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: listeningHistory.id })
        .from(listeningHistory)
        .where(
          and(
            eq(listeningHistory.userId, ctx.session.user.id),
            eq(listeningHistory.trackId, input.trackId),
          ),
        )
        .orderBy(desc(listeningHistory.playedAt))
        .limit(1);
      if (row) {
        await ctx.db
          .delete(listeningHistory)
          .where(eq(listeningHistory.id, row.id));
      }
      return { success: true };
    }),

  addSearchQuery: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(512) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(searchHistory).values({
        userId: ctx.session.user.id,
        query: input.query,
      });

      return { success: true };
    }),

  getRecentSearches: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .selectDistinct({
          query: searchHistory.query,
          searchedAt: sql<Date>`MAX(${searchHistory.searchedAt})`,
        })
        .from(searchHistory)
        .where(eq(searchHistory.userId, ctx.session.user.id))
        .groupBy(searchHistory.query)
        .orderBy(desc(sql`MAX(${searchHistory.searchedAt})`))
        .limit(input.limit);

      return items.map((item: { query: string }) => item.query);
    }),

  getTasteProfile: protectedProcedure.query(async ({ ctx }) => {
    const existing =
      (await ctx.db.query.userTasteProfiles.findFirst({
        where: eq(userTasteProfiles.userId, ctx.session.user.id),
      })) ?? null;

    const inferred = await inferTasteProfileFromBehavior(
      ctx.db,
      ctx.session.user.id,
      existing,
    );

    const merged = mergeTasteProfileSignals(
      ctx.session.user.id,
      existing,
      inferred,
    );

    const hasSignals =
      merged.seedArtists.length > 0 ||
      merged.seedPlaylistTitles.length > 0 ||
      merged.preferredGenreId !== null ||
      Boolean(merged.preferredGenreName);

    if (!existing && !hasSignals) {
      return null;
    }

    return merged;
  }),

  upsertTasteProfile: protectedProcedure
    .input(
      z.object({
        preferredGenreId: z.number().int().positive().nullable().optional(),
        preferredGenreName: z.string().trim().max(120).nullable().optional(),
        seedArtists: z
          .array(z.string().trim().min(1).max(120))
          .max(24)
          .optional(),
        seedPlaylistTitles: z
          .array(z.string().trim().min(1).max(200))
          .max(24)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userTasteProfiles.findFirst({
        where: eq(userTasteProfiles.userId, ctx.session.user.id),
      });

      const preferredGenreName =
        input.preferredGenreName === undefined
          ? undefined
          : input.preferredGenreName
            ? input.preferredGenreName.trim()
            : null;

      const seedArtists =
        input.seedArtists && input.seedArtists.length > 0
          ? normalizeTasteStrings(input.seedArtists, TASTE_MAX_SEEDS)
          : undefined;
      const seedPlaylistTitles =
        input.seedPlaylistTitles && input.seedPlaylistTitles.length > 0
          ? normalizeTasteStrings(input.seedPlaylistTitles, TASTE_MAX_SEEDS)
          : undefined;

      if (!existing) {
        await ctx.db.insert(userTasteProfiles).values({
          userId: ctx.session.user.id,
          preferredGenreId: input.preferredGenreId ?? null,
          preferredGenreName: preferredGenreName ?? null,
          seedArtists: seedArtists ?? [],
          seedPlaylistTitles: seedPlaylistTitles ?? [],
          updatedAt: new Date(),
        });
      } else {
        const updatePayload: Partial<typeof userTasteProfiles.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (input.preferredGenreId !== undefined) {
          updatePayload.preferredGenreId = input.preferredGenreId;
        }

        if (preferredGenreName !== undefined) {
          updatePayload.preferredGenreName = preferredGenreName;
        }

        if (seedArtists !== undefined) {
          updatePayload.seedArtists = normalizeTasteStrings(
            [...seedArtists, ...(existing.seedArtists ?? [])],
            TASTE_MAX_SEEDS,
          );
        }

        if (seedPlaylistTitles !== undefined) {
          updatePayload.seedPlaylistTitles = normalizeTasteStrings(
            [...seedPlaylistTitles, ...(existing.seedPlaylistTitles ?? [])],
            TASTE_MAX_SEEDS,
          );
        }

        await ctx.db
          .update(userTasteProfiles)
          .set(updatePayload)
          .where(eq(userTasteProfiles.userId, ctx.session.user.id));
      }

      return (
        (await ctx.db.query.userTasteProfiles.findFirst({
          where: eq(userTasteProfiles.userId, ctx.session.user.id),
        })) ?? null
      );
    }),

  getUserPreferences: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await ctx.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.session.user.id),
    });

    if (!prefs) {
      const [newPrefs] = await ctx.db
        .insert(userPreferences)
        .values({ userId: ctx.session.user.id })
        .returning();
      prefs = newPrefs;
    }

    if (!prefs) {
      throw new Error("Failed to load user preferences");
    }

    if (prefs.theme === "light") {
      const [migratedPrefs] = await ctx.db
        .update(userPreferences)
        .set({ theme: "dark" })
        .where(eq(userPreferences.userId, ctx.session.user.id))
        .returning();

      if (migratedPrefs) {
        return migratedPrefs;
      }

      const refreshedPrefs = await ctx.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, ctx.session.user.id),
      });
      if (refreshedPrefs) {
        return refreshedPrefs;
      }
    }

    return prefs;
  }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        volume: z.number().min(0).max(1).optional(),
        repeatMode: z.enum(["none", "one", "all"]).optional(),
        shuffleEnabled: z.boolean().optional(),
        keepPlaybackAlive: z.boolean().optional(),
        equalizerEnabled: z.boolean().optional(),
        equalizerPreset: z.string().optional(),
        equalizerBands: z.array(z.number()).optional(),
        equalizerPanelOpen: z.boolean().optional(),
        queuePanelOpen: z.boolean().optional(),
        visualizerType: z.enum(["flowfield", "kaleidoscope"]).optional(),
        visualizerEnabled: z.boolean().optional(),
        compactMode: z.boolean().optional(),
        theme: z.enum(["dark", "light"]).optional(),
        autoQueueEnabled: z.boolean().optional(),
        autoQueueThreshold: z.number().min(1).max(10).optional(),
        autoQueueCount: z.number().min(1).max(20).optional(),
        smartMixEnabled: z.boolean().optional(),
        similarityPreference: z
          .enum(["strict", "balanced", "diverse"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedInput = {
        ...input,
        ...(input.theme !== undefined ? { theme: "dark" as const } : {}),
      };

      const existing = await ctx.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, ctx.session.user.id),
      });

      if (!existing) {
        await ctx.db.insert(userPreferences).values({
          userId: ctx.session.user.id,
          ...normalizedInput,
        });
      } else {
        await ctx.db
          .update(userPreferences)
          .set(normalizedInput)
          .where(eq(userPreferences.userId, ctx.session.user.id));
      }

      return { success: true };
    }),

  resetPreferences: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(userPreferences)
      .where(eq(userPreferences.userId, ctx.session.user.id));

    return { success: true };
  }),

  saveQueueState: protectedProcedure
    .input(
      z.object({
        queueState: z
          .object({
            version: z.literal(2),
            queuedTracks: z.array(
              z.object({
                track: z.any(),
                queueSource: z.enum(["user", "smart"]),
                addedAt: z.string(),
                queueId: z.string(),
              }),
            ),
            smartQueueState: z.object({
              isActive: z.boolean(),
              lastRefreshedAt: z.string().nullable(),
              seedTrackId: z.number().nullable(),
              trackCount: z.number(),
            }),
            history: z.array(z.any()),
            currentTime: z.number(),
            isShuffled: z.boolean(),
            repeatMode: z.enum(["none", "one", "all"]),
          })
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, ctx.session.user.id),
      });

      const normalizedQueueState = input.queueState
        ? ({
            version: input.queueState.version,
            queuedTracks: input.queueState.queuedTracks.map((item) => ({
              track: (item.track ?? null) as Track | null,
              queueSource: item.queueSource,
              addedAt: item.addedAt,
              queueId: item.queueId,
            })),
            smartQueueState: input.queueState.smartQueueState,
            history: input.queueState.history,
            currentTime: input.queueState.currentTime,
            isShuffled: input.queueState.isShuffled,
            repeatMode: input.queueState.repeatMode,
          } as {
            version: 2;
            queuedTracks: Array<{
              track: Track | null;
              queueSource: "user" | "smart";
              addedAt: string;
              queueId: string;
            }>;
            smartQueueState: {
              isActive: boolean;
              lastRefreshedAt: string | null;
              seedTrackId: number | null;
            };
            history: unknown[];
            currentTime: number;
            isShuffled: boolean;
            repeatMode: "none" | "one" | "all";
          })
        : null;

      if (!existing) {
        await ctx.db.insert(userPreferences).values({
          userId: ctx.session.user.id,
          queueState: normalizedQueueState,
        });
      } else {
        await ctx.db
          .update(userPreferences)
          .set({ queueState: normalizedQueueState })
          .where(eq(userPreferences.userId, ctx.session.user.id));
      }

      return { success: true };
    }),

  getQueueState: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.session.user.id),
    });

    return prefs?.queueState ?? null;
  }),

  clearQueueState: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.session.user.id),
    });

    if (existing) {
      await ctx.db
        .update(userPreferences)
        .set({ queueState: null })
        .where(eq(userPreferences.userId, ctx.session.user.id));
    }

    return { success: true };
  }),

  createSession: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        deviceName: z.string().optional(),
        userAgent: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.playerSessions.findFirst({
        where: and(
          eq(playerSessions.userId, ctx.session.user.id),
          eq(playerSessions.deviceId, input.deviceId),
        ),
      });

      if (existing) {
        await ctx.db
          .update(playerSessions)
          .set({
            lastActive: new Date(),
            isActive: true,
            deviceName: input.deviceName ?? existing.deviceName,
            userAgent: input.userAgent ?? existing.userAgent,
          })
          .where(eq(playerSessions.id, existing.id));

        return { sessionId: existing.id, isNew: false };
      }

      const [newSession] = await ctx.db
        .insert(playerSessions)
        .values({
          userId: ctx.session.user.id,
          deviceId: input.deviceId,
          deviceName: input.deviceName,
          userAgent: input.userAgent,
        })
        .returning();

      return { sessionId: newSession!.id, isNew: true };
    }),

  updateSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(playerSessions)
        .set({ lastActive: new Date() })
        .where(
          and(
            eq(playerSessions.id, input.sessionId),
            eq(playerSessions.userId, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  endSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(playerSessions)
        .set({ isActive: false })
        .where(
          and(
            eq(playerSessions.id, input.sessionId),
            eq(playerSessions.userId, ctx.session.user.id),
          ),
        );

      return { success: true };
    }),

  getActiveSessions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.playerSessions.findMany({
      where: and(
        eq(playerSessions.userId, ctx.session.user.id),
        eq(playerSessions.isActive, true),
      ),
      orderBy: [desc(playerSessions.lastActive)],
    });
  }),

  savePlaybackState: protectedProcedure
    .input(
      z.object({
        sessionId: z.number().optional(),
        currentTrack: trackSchema.optional(),
        currentPosition: z.number().min(0).optional(),
        queue: z.array(trackSchema).optional(),
        history: z.array(trackSchema).optional(),
        isShuffled: z.boolean().optional(),
        repeatMode: z.enum(["none", "one", "all"]).optional(),
        originalQueueOrder: z.array(trackSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.playbackState.findFirst({
        where: eq(playbackState.userId, ctx.session.user.id),
      });

      const stateData = {
        sessionId: input.sessionId,
        currentTrack: input.currentTrack,
        currentTrackDeezerId: input.currentTrack
          ? getDeezerId(input.currentTrack)
          : undefined,
        currentPosition: input.currentPosition,
        queue: input.queue,
        history: input.history,
        isShuffled: input.isShuffled,
        repeatMode: input.repeatMode,
        originalQueueOrder: input.originalQueueOrder,
        lastUpdated: new Date(),
      };

      if (!existing) {
        await ctx.db.insert(playbackState).values({
          userId: ctx.session.user.id,
          ...stateData,
        });
      } else {
        await ctx.db
          .update(playbackState)
          .set(stateData)
          .where(eq(playbackState.userId, ctx.session.user.id));
      }

      return { success: true };
    }),

  getPlaybackState: protectedProcedure.query(async ({ ctx }) => {
    const state = await ctx.db.query.playbackState.findFirst({
      where: eq(playbackState.userId, ctx.session.user.id),
      orderBy: [desc(playbackState.lastUpdated)],
    });

    if (!state) {
      return null;
    }

    return {
      ...state,
      currentTrack: state.currentTrack as Track | null,
      queue: (state.queue as Track[]) ?? [],
      history: (state.history as Track[]) ?? [],
      originalQueueOrder: (state.originalQueueOrder as Track[]) ?? [],
    };
  }),

  clearPlaybackState: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(playbackState)
      .where(eq(playbackState.userId, ctx.session.user.id));

    return { success: true };
  }),

  logPlay: protectedProcedure
    .input(
      z.object({
        track: trackSchema,
        sessionId: z.number().optional(),
        duration: z.number().optional(),
        totalDuration: z.number(),
        skipped: z.boolean().default(false),
        playContext: z
          .enum(["playlist", "search", "favorites", "queue", "album", "artist"])
          .optional(),
        contextId: z.number().optional(),
        deviceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const completionPercentage = input.duration
        ? (input.duration / input.totalDuration) * 100
        : 0;

      await ctx.db.insert(listeningAnalytics).values({
        userId: ctx.session.user.id,
        trackId: input.track.id,
        deezerId: getDeezerId(input.track),
        trackData: input.track,
        sessionId: input.sessionId,
        duration: input.duration,
        totalDuration: input.totalDuration,
        completionPercentage,
        skipped: input.skipped,
        playContext: input.playContext,
        contextId: input.contextId,
        deviceId: input.deviceId,
      });

      const shouldSync =
        input.track.id % 5 === 0 ||
        (completionPercentage >= 80 && !input.skipped);
      if (shouldSync) {
        syncAutoFavorites(ctx.db, ctx.session.user.id).catch((error) => {
          console.error("[logPlay] Error syncing auto-favorites:", error);
        });
      }

      return { success: true };
    }),

  getListeningStats: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const stats = await ctx.db
        .select({
          totalPlays: sql<number>`COUNT(*)`,
          totalDuration: sql<number>`SUM(${listeningAnalytics.duration})`,
          completedPlays: sql<number>`COUNT(*) FILTER (WHERE ${listeningAnalytics.skipped} = false)`,
          skippedPlays: sql<number>`COUNT(*) FILTER (WHERE ${listeningAnalytics.skipped} = true)`,
          avgCompletion: sql<number>`AVG(${listeningAnalytics.completionPercentage})`,
        })
        .from(listeningAnalytics)
        .where(
          and(
            eq(listeningAnalytics.userId, ctx.session.user.id),
            sql`${listeningAnalytics.playedAt} >= ${since}`,
          ),
        );

      return (
        stats[0] ?? {
          totalPlays: 0,
          totalDuration: 0,
          completedPlays: 0,
          skippedPlays: 0,
          avgCompletion: 0,
        }
      );
    }),

  getTopTracks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const topTracks = await ctx.db
        .select({
          trackId: listeningAnalytics.trackId,
          trackData: listeningAnalytics.trackData,
          playCount: sql<number>`COUNT(*)`,
          totalDuration: sql<number>`SUM(${listeningAnalytics.duration})`,
        })
        .from(listeningAnalytics)
        .where(
          and(
            eq(listeningAnalytics.userId, ctx.session.user.id),
            sql`${listeningAnalytics.playedAt} >= ${since}`,
          ),
        )
        .groupBy(listeningAnalytics.trackId, listeningAnalytics.trackData)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(input.limit);

      return topTracks.map(
        (item: {
          trackData: unknown;
          playCount: number;
          totalDuration: number | null;
        }) => ({
          track: item.trackData as Track,
          playCount: item.playCount,
          totalDuration: item.totalDuration,
        }),
      );
    }),

  getTopArtists: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const items = await ctx.db
        .select({
          trackData: listeningAnalytics.trackData,
        })
        .from(listeningAnalytics)
        .where(
          and(
            eq(listeningAnalytics.userId, ctx.session.user.id),
            sql`${listeningAnalytics.playedAt} >= ${since}`,
          ),
        );

      const artistCounts = new Map<
        number,
        { name: string; count: number; artistData: Track["artist"] }
      >();

      for (const item of items) {
        const track = item.trackData as Track;
        const artistId = track.artist.id;

        if (!artistCounts.has(artistId)) {
          artistCounts.set(artistId, {
            name: track.artist.name,
            count: 0,
            artistData: track.artist,
          });
        }

        artistCounts.get(artistId)!.count++;
      }

      return Array.from(artistCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit)
        .map((item) => ({
          artist: item.artistData,
          playCount: item.count,
        }));
    }),

  getRecommendations: protectedProcedure
    .input(
      z.object({
        seedTrackId: z.number(),
        limit: z.number().min(1).max(50).default(20),
        excludeTrackIds: z.array(z.number()).optional(),
        useCache: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.useCache) {
        const cached = await ctx.db.query.recommendationCache.findFirst({
          where: and(
            eq(recommendationCache.seedTrackId, input.seedTrackId),
            sql`${recommendationCache.expiresAt} > NOW()`,
          ),
        });

        if (cached) {
          let tracks = cached.recommendedTracksData as Track[];

          if (input.excludeTrackIds && input.excludeTrackIds.length > 0) {
            tracks = tracks.filter(
              (t) => !input.excludeTrackIds!.includes(t.id),
            );
          }

          return tracks.slice(0, input.limit);
        }
      }

      const topArtists = await ctx.db
        .select({
          trackData: listeningAnalytics.trackData,
        })
        .from(listeningAnalytics)
        .where(eq(listeningAnalytics.userId, ctx.session.user.id))
        .limit(100);

      const artistCounts = new Map<number, number>();
      for (const item of topArtists) {
        const track = item.trackData as Track;
        artistCounts.set(
          track.artist.id,
          (artistCounts.get(track.artist.id) ?? 0) + 1,
        );
      }

      const topArtistIds = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      const seedTrackResponse = await fetch(
        `https://api.deezer.com/track/${input.seedTrackId}`,
      );
      const seedTrack = (await seedTrackResponse.json()) as Track;

      const recommendations = await fetchHybridRecommendations(
        seedTrack,
        topArtistIds,
        input.limit + 10,
      );

      const filtered = filterRecommendations(recommendations, {
        excludeTrackIds: input.excludeTrackIds,
      });

      await ctx.db.insert(recommendationCache).values({
        seedTrackId: input.seedTrackId,
        seedDeezerId: getDeezerId(seedTrack as z.infer<typeof trackSchema>),
        recommendedTrackIds: filtered.map((t) => t.id),
        recommendedTracksData: filtered,
        source: "deezer",
        expiresAt: getCacheExpiryDate(),
      });

      return filtered.slice(0, input.limit);
    }),

  getIntelligentRecommendations: protectedProcedure
    .input(
      z.object({
        trackNames: z.array(z.string()).min(1),
        count: z.number().min(1).max(50).default(10),
        excludeTrackIds: z.array(z.number()).optional(),
        excludeSpotifyTrackIds: z.array(z.string()).optional(),
        recommendationSource: z.enum(["spotify", "unified"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const userPrefs = await ctx.db.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, ctx.session.user.id),
        });

        const similarityPreference =
          userPrefs?.similarityPreference ?? "balanced";
        const mode = "diverse";
        const recommendationSource = input.recommendationSource ?? "spotify";
        const recommendationEndpoint =
          recommendationSource === "unified"
            ? "/api/spotify/recommendations/spice-up/unified"
            : "/api/spotify/recommendations/spice-up";

        console.log("[IntelligentRecommendations] Using mode:", {
          similarityPreference,
          mode,
          recommendationSource,
          userId: ctx.session.user.id,
        });

        const songs = input.trackNames
          .map((trackName) => trackName.trim())
          .filter((trackName) => trackName.length > 0)
          .map((trackName) => ({ name: trackName }));

        if (songs.length === 0) {
          return [];
        }
        if (songs.length === 1) {
          const first = songs[0];
          if (first) {
            songs.push({
              name: first.name,
            });
          }
        }

        const payload = await bluesix.request<SpiceUpResponse>(
          recommendationEndpoint,
          {
            method: "POST",
            body: JSON.stringify({
              songs,
              limit: input.count * 2,
              mode,
              ...(input.excludeTrackIds && input.excludeTrackIds.length > 0
                ? { excludeDeezerIds: input.excludeTrackIds }
                : {}),
              ...(input.excludeSpotifyTrackIds &&
              input.excludeSpotifyTrackIds.length > 0
                ? { excludeTrackIds: input.excludeSpotifyTrackIds }
                : {}),
            }),
          },
        );
        const spiceTracks = extractSpiceUpTracks(payload);
        const tracks = await resolveSpiceUpTracksToDeezer(spiceTracks);

        if (payload.warnings && payload.warnings.length > 0) {
          console.warn(
            "[IntelligentRecommendations] API warnings:",
            payload.warnings,
          );
        }

        if (tracks.length === 0) {
          console.warn(
            "[IntelligentRecommendations] Backend returned no valid tracks",
            {
              payloadPreview: spiceTracks.slice(0, 2),
            },
          );
          return [];
        }

        const filtered = filterRecommendations(tracks, {
          excludeTrackIds: input.excludeTrackIds,
        });

        return filtered.slice(0, input.count);
      } catch (error) {
        console.error("Failed to get intelligent recommendations:", error);
        return [];
      }
    }),

  getSimilarTracks: protectedProcedure
    .input(
      z.object({
        trackId: z.number(),
        limit: z.number().min(1).max(50).default(5),
        excludeTrackIds: z.array(z.number()).optional(),
        excludeSpotifyTrackIds: z.array(z.string()).optional(),
        similarityLevel: z
          .enum(["strict", "balanced", "diverse"])
          .default("balanced"),
        useEnhanced: z.boolean().default(true),
        excludeExplicit: z.boolean().optional(),
        recommendationSource: z.enum(["spotify", "unified"]).optional(),
        maxSeeds: z.number().int().min(1).max(200).optional(),
        sampling: z
          .enum(["round-robin", "evenly-spaced", "weighted"])
          .optional(),
        seedStride: z.number().int().min(1).optional(),
        queueMode: z
          .enum(["useQueueOnly", "blendHistory", "includeHistory"])
          .optional(),
        seedTracks: z
          .array(
            z.object({
              name: z.string(),
              artist: z.string().optional(),
              album: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.transaction(async () => {
        const cached = await ctx.db.query.recommendationCache.findFirst({
          where: and(
            eq(recommendationCache.seedTrackId, input.trackId),
            sql`${recommendationCache.expiresAt} > NOW()`,
          ),
        });

        if (!input.useEnhanced && cached) {
          let tracks = cached.recommendedTracksData as Track[];

          if (input.excludeTrackIds && input.excludeTrackIds.length > 0) {
            tracks = tracks.filter(
              (t) => !input.excludeTrackIds!.includes(t.id),
            );
          }

          return tracks.slice(0, input.limit);
        }

        if (!input.useEnhanced) {
          const recommendations = await fetchDeezerRecommendations(
            input.trackId,
            input.limit + 5,
          );

          const filtered = filterRecommendations(recommendations, {
            excludeTrackIds: [...(input.excludeTrackIds ?? []), input.trackId],
            maxExplicit: input.excludeExplicit ? false : undefined,
          });

          if (filtered.length > 0 && !cached) {
            try {
              const seedDeezerId = filtered[0]?.deezer_id
                ? typeof filtered[0].deezer_id === "string"
                  ? parseInt(filtered[0].deezer_id, 10)
                  : filtered[0].deezer_id
                : undefined;

              await ctx.db.insert(recommendationCache).values({
                seedTrackId: input.trackId,
                seedDeezerId,
                recommendedTrackIds: filtered.map((t) => t.id),
                recommendedTracksData: filtered,
                source: "deezer",
                expiresAt: getCacheExpiryDate(),
              });
            } catch {}
          }

          return filtered.slice(0, input.limit);
        }

        let seedTrack: Track | null = null;
        try {
          const response = await fetch(
            `https://api.deezer.com/track/${input.trackId}`,
          );
          if (response.ok) {
            seedTrack = (await response.json()) as Track;
          }
        } catch (error) {
          console.error("[getSimilarTracks] Error fetching seed track:", error);
        }

        if (!seedTrack) {
          const recommendations = await fetchDeezerRecommendations(
            input.trackId,
            input.limit + 5,
          );
          return filterRecommendations(recommendations, {
            excludeTrackIds: [...(input.excludeTrackIds ?? []), input.trackId],
            maxExplicit: input.excludeExplicit ? false : undefined,
          }).slice(0, input.limit);
        }

        const recentHistory = await ctx.db.query.listeningHistory.findMany({
          where: eq(listeningHistory.userId, ctx.session.user.id),
          orderBy: desc(listeningHistory.playedAt),
          limit: 50,
        });

        const queueMode = input.queueMode ?? "useQueueOnly";
        const sampling = input.sampling ?? "evenly-spaced";
        const maxSeeds = input.maxSeeds ?? 30;

        const inputSeedTracks = (input.seedTracks ?? [])
          .map((track) => ({
            name: track.name.trim(),
            artist: track.artist?.trim(),
            album: track.album?.trim(),
          }))
          .filter((track) => track.name.length > 0);

        const historySeeds =
          queueMode === "useQueueOnly"
            ? []
            : recentHistory
                .map(
                  (entry: { trackData: unknown }) => entry.trackData as Track,
                )
                .filter((track) => isTrack(track))
                .map((track) => ({
                  name: track.title,
                  artist: track.artist.name,
                  album: track.album?.title,
                }));

        const seedCandidates = [
          {
            name: seedTrack.title,
            artist: seedTrack.artist.name,
            album: seedTrack.album?.title,
          },
          ...inputSeedTracks,
          ...historySeeds,
        ];

        const seenSeeds = new Set<string>();
        const seedInputs: Array<{
          name: string;
          artist?: string;
          album?: string;
        }> = [];

        for (const candidate of seedCandidates) {
          const name = candidate.name?.trim();
          if (!name) continue;
          const artist = candidate.artist?.trim();
          const key = `${name.toLowerCase()}|${artist?.toLowerCase() ?? ""}`;
          if (seenSeeds.has(key)) continue;
          seenSeeds.add(key);
          seedInputs.push({
            name,
            artist,
            album: candidate.album,
          });
        }

        if (seedInputs.length === 0) {
          seedInputs.push({
            name: seedTrack.title,
            artist: seedTrack.artist.name,
            album: seedTrack.album?.title,
          });
        }

        if (seedInputs.length === 1) {
          const firstSeed = seedInputs[0];
          if (firstSeed) {
            seedInputs.push({ ...firstSeed });
          }
        }

        try {
          const mode =
            input.similarityLevel === "strict"
              ? "strict"
              : input.similarityLevel === "diverse"
                ? "diverse"
                : "balanced";
          const excludeDeezerIds = Array.from(
            new Set([...(input.excludeTrackIds ?? []), input.trackId]),
          );
          const recommendationEndpoint =
            input.recommendationSource === "spotify"
              ? "/api/spotify/recommendations/spice-up"
              : "/api/spotify/recommendations/spice-up/unified";

          const recommendationResponse = await bluesix.request<SpiceUpResponse>(
            recommendationEndpoint,
            {
              method: "POST",
              body: JSON.stringify({
                songs: seedInputs,
                limit: Math.min(input.limit + 10, 100),
                mode,
                maxSeeds,
                sampling,
                queueMode,
                ...(typeof input.seedStride === "number"
                  ? { seedStride: input.seedStride }
                  : {}),
                ...(excludeDeezerIds.length > 0 ? { excludeDeezerIds } : {}),
                ...(input.excludeSpotifyTrackIds &&
                input.excludeSpotifyTrackIds.length > 0
                  ? { excludeTrackIds: input.excludeSpotifyTrackIds }
                  : {}),
                ...(input.excludeExplicit ? { excludeExplicit: true } : {}),
              }),
            },
          );

          if (
            recommendationResponse.warnings &&
            recommendationResponse.warnings.length > 0
          ) {
            console.warn(
              "[getSimilarTracks] API warnings:",
              recommendationResponse.warnings,
            );
          }

          if (
            recommendationResponse.foundSongs !== undefined &&
            recommendationResponse.inputSongs !== undefined &&
            recommendationResponse.foundSongs <
              recommendationResponse.inputSongs
          ) {
            console.warn(
              `[getSimilarTracks] Only ${recommendationResponse.foundSongs} of ${recommendationResponse.inputSongs} input songs were found`,
            );
          }

          const spiceTracks = extractSpiceUpTracks(recommendationResponse);
          const resolvedTracks =
            await resolveSpiceUpTracksToDeezer(spiceTracks);

          if (resolvedTracks.length > 0) {
            const filtered = filterRecommendations(resolvedTracks, {
              excludeTrackIds: [
                ...(input.excludeTrackIds ?? []),
                input.trackId,
              ],
              maxExplicit: input.excludeExplicit ? false : undefined,
            });

            if (filtered.length > 0) {
              return filtered.slice(0, input.limit);
            }
          }

          const similarParams = new URLSearchParams();
          similarParams.set("artist", seedTrack.artist.name);
          similarParams.set("track", seedTrack.title);
          similarParams.set(
            "limit",
            Math.min(input.limit + 10, 100).toString(),
          );
          const similarResponse = await bluesix.request<unknown>(
            `/api/lastfm/track/similar?${similarParams.toString()}`,
          );

          const similarCandidates = (() => {
            const payload = similarResponse as {
              similartracks?: { track?: Array<unknown> };
              track?: Array<unknown>;
            };
            const rawTracks =
              payload.similartracks?.track ?? payload.track ?? [];
            return rawTracks
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const record = entry as Record<string, unknown>;
                const name =
                  typeof record.name === "string" ? record.name : null;
                let artist: string | undefined;
                const rawArtist = record.artist;
                if (typeof rawArtist === "string") {
                  artist = rawArtist;
                } else if (rawArtist && typeof rawArtist === "object") {
                  const artistRecord = rawArtist as Record<string, unknown>;
                  if (typeof artistRecord.name === "string") {
                    artist = artistRecord.name;
                  }
                }
                if (!name) return null;
                return { name, artist };
              })
              .filter(
                (
                  track,
                ): track is { name: string; artist: string | undefined } =>
                  track !== null && Boolean(track.name),
              );
          })();

          const similarDeezerIds = await convertToDeezerIds(similarCandidates);
          if (similarDeezerIds.length > 0) {
            const tracks = await fetchTracksByDeezerIds(similarDeezerIds, {
              excludeTrackIds: [
                ...(input.excludeTrackIds ?? []),
                input.trackId,
              ],
              maxExplicit: input.excludeExplicit ? false : undefined,
            });
            if (tracks.length > 0) {
              return tracks;
            }
          }

          const spotifyResponse = await bluesix.request<{
            tracks?: Array<{
              name?: string;
              artists?: Array<{ name?: string }>;
            }>;
          }>("/api/spotify/recommendations/from-search", {
            method: "POST",
            body: JSON.stringify({
              query: `${seedTrack.artist.name} ${seedTrack.title}`,
              limit: Math.min(input.limit + 10, 100),
            }),
          });

          const spotifyCandidates = (spotifyResponse.tracks ?? [])
            .map((track) => {
              if (!track?.name) return null;
              const artist = track.artists?.[0]?.name;
              return { name: track.name, artist };
            })
            .filter(
              (track): track is { name: string; artist: string | undefined } =>
                track !== null && Boolean(track.name),
            );

          const spotifyDeezerIds = await convertToDeezerIds(spotifyCandidates);
          if (spotifyDeezerIds.length > 0) {
            const tracks = await fetchTracksByDeezerIds(spotifyDeezerIds, {
              excludeTrackIds: [
                ...(input.excludeTrackIds ?? []),
                input.trackId,
              ],
              maxExplicit: input.excludeExplicit ? false : undefined,
            });
            if (tracks.length > 0) {
              return tracks;
            }
          }
        } catch (error) {
          console.error(
            "[getSimilarTracks] Bluesix recommendations failed:",
            error,
          );
        }

        const recommendations = await fetchEnhancedRecommendations(seedTrack, {
          userFavoriteArtistIds: [],
          recentlyPlayedTrackIds: recentHistory.map(
            (h: { trackId: number }) => h.trackId,
          ),
          similarityLevel: input.similarityLevel,
          limit: input.limit + 10,
        });

        const filtered = filterRecommendations(recommendations, {
          excludeTrackIds: [...(input.excludeTrackIds ?? []), input.trackId],
          maxExplicit: input.excludeExplicit ? false : undefined,
        });

        return filtered.slice(0, input.limit);
      });
    }),

  generateSmartMix: protectedProcedure
    .input(
      z.object({
        seedTrackIds: z.array(z.number()).min(1).max(5),
        limit: z.number().min(10).max(100).default(50),
        diversity: z
          .enum(["strict", "balanced", "diverse"])
          .default("balanced"),
        excludeSpotifyTrackIds: z.array(z.string()).optional(),
        recommendationSource: z.enum(["spotify", "unified"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const seedTracks: Track[] = [];
        for (const trackId of input.seedTrackIds) {
          try {
            const response = await fetch(
              `https://api.deezer.com/track/${trackId}`,
            );
            if (response.ok) {
              const track = (await response.json()) as Track;
              seedTracks.push(track);
            }
          } catch (error) {
            console.error(`Failed to fetch seed track ${trackId}:`, error);
          }
        }

        if (seedTracks.length === 0) {
          throw new Error("Could not fetch any seed tracks");
        }

        const mode = "diverse";
        const recommendationSource = input.recommendationSource ?? "unified";
        const recommendationEndpoint =
          recommendationSource === "spotify"
            ? "/api/spotify/recommendations/spice-up"
            : "/api/spotify/recommendations/spice-up/unified";

        console.log("[SmartMix] Generating with mode:", {
          diversity: input.diversity,
          mode,
          recommendationSource,
          seedCount: seedTracks.length,
          userId: ctx.session.user.id,
        });

        const songs: Array<{ name: string; artist?: string; album?: string }> =
          seedTracks.map((track) => ({
            name: track.title,
            artist: track.artist.name,
            album: track.album?.title,
          }));
        if (songs.length === 1) {
          const [firstSong] = songs;
          if (firstSong) {
            songs.push({ ...firstSong });
          }
        }

        const payload = await bluesix.request<SpiceUpResponse>(
          recommendationEndpoint,
          {
            method: "POST",
            body: JSON.stringify({
              songs,
              limit: input.limit * 2,
              mode,
              excludeDeezerIds: input.seedTrackIds,
              ...(input.excludeSpotifyTrackIds &&
              input.excludeSpotifyTrackIds.length > 0
                ? { excludeTrackIds: input.excludeSpotifyTrackIds }
                : {}),
            }),
          },
        );
        const spiceTracks = extractSpiceUpTracks(payload);
        const resolvedTracks = await resolveSpiceUpTracksToDeezer(spiceTracks);
        const candidateTracks = resolvedTracks.filter(
          (track) => !input.seedTrackIds.includes(track.id),
        );

        if (candidateTracks.length === 0) {
          throw new Error("No valid recommendation tracks received");
        }

        let finalMix: Track[];
        switch (input.diversity) {
          case "diverse":
            finalMix = candidateTracks
              .sort(() => Math.random() - 0.5)
              .slice(0, input.limit);
            break;
          case "balanced":
            finalMix = shuffleWithDiversity(candidateTracks).slice(
              0,
              input.limit,
            );
            break;
          case "strict":
            finalMix = candidateTracks.slice(0, input.limit);
            break;
          default:
            finalMix = candidateTracks.slice(0, input.limit);
            break;
        }

        return {
          tracks: finalMix,
          seedCount: seedTracks.length,
          totalCandidates: candidateTracks.length,
        };
      } catch (error) {
        console.error(
          "[SmartMix] Error generating mix, using enhanced fallback:",
          error,
        );

        const userFavorites = await ctx.db.query.favorites.findMany({
          where: eq(favorites.userId, ctx.session.user.id),
          limit: 100,
        });

        const userFavoriteArtistIds = [
          ...new Set<number>(
            userFavorites
              .map(
                (f: { trackData: unknown }) =>
                  (f.trackData as Track | null)?.artist?.id,
              )
              .filter((id: unknown): id is number => typeof id === "number"),
          ),
        ];

        const seedTracksForFallback: Track[] = [];
        for (const trackId of input.seedTrackIds) {
          try {
            const response = await fetch(
              `https://api.deezer.com/track/${trackId}`,
            );
            if (response.ok) {
              const track = (await response.json()) as Track;
              seedTracksForFallback.push(track);
            }
          } catch {}
        }

        if (seedTracksForFallback.length === 0) {
          const allRecommendations: Track[] = [];
          const seenTrackIds = new Set<number>(input.seedTrackIds);

          for (const seedTrackId of input.seedTrackIds) {
            const recs = await fetchDeezerRecommendations(seedTrackId, 20);
            for (const track of recs) {
              if (!seenTrackIds.has(track.id)) {
                allRecommendations.push(track);
                seenTrackIds.add(track.id);
              }
            }
          }

          const finalMix = shuffleWithDiversity(allRecommendations).slice(
            0,
            input.limit,
          );

          return {
            tracks: finalMix,
            seedCount: input.seedTrackIds.length,
            totalCandidates: allRecommendations.length,
          };
        }

        const diversityWeight =
          input.diversity === "diverse"
            ? 0.8
            : input.diversity === "strict"
              ? 0.2
              : 0.5;

        const multiSeedResult = await fetchMultiSeedRecommendations(
          seedTracksForFallback,
          {
            userFavoriteArtistIds,
            limit: input.limit,
            diversityWeight,
          },
        );

        return {
          tracks: multiSeedResult.tracks,
          seedCount: seedTracksForFallback.length,
          totalCandidates: multiSeedResult.totalCandidates,
        };
      }
    }),

  logRecommendation: protectedProcedure
    .input(
      z.object({
        seedTracks: z.array(trackSchema).min(1),
        recommendedTracks: z.array(trackSchema),
        source: z.enum([
          "hexmusic-api",
          "deezer-fallback",
          "artist-radio",
          "cached",
        ]),
        requestParams: z
          .object({
            count: z.number().optional(),
            similarityLevel: z
              .enum(["strict", "balanced", "diverse"])
              .optional(),
            useAudioFeatures: z.boolean().optional(),
          })
          .optional(),
        responseTime: z.number().optional(),
        success: z.boolean(),
        errorMessage: z.string().optional(),
        context: z
          .enum(["auto-queue", "smart-mix", "manual", "similar-tracks"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(recommendationLogs).values({
        userId: ctx.session.user.id,
        seedTrackIds: input.seedTracks.map((t) => t.id),
        seedTrackData: input.seedTracks,
        recommendedTrackIds: input.recommendedTracks.map((t) => t.id),
        recommendedTracksData: input.recommendedTracks,
        source: input.source,
        requestParams: input.requestParams,
        responseTime: input.responseTime,
        success: input.success,
        errorMessage: input.errorMessage,
        context: input.context,
      });

      return { success: true };
    }),

  getSmartQueueSettings: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.session.user.id),
    });

    if (!prefs) {
      return {
        autoQueueEnabled: false,
        autoQueueThreshold: 3,
        autoQueueCount: 5,
        smartMixEnabled: true,
        similarityPreference: "balanced" as const,
      };
    }

    return {
      autoQueueEnabled: prefs.autoQueueEnabled,
      autoQueueThreshold: prefs.autoQueueThreshold,
      autoQueueCount: prefs.autoQueueCount,
      smartMixEnabled: prefs.smartMixEnabled,
      similarityPreference: prefs.similarityPreference as
        | "strict"
        | "balanced"
        | "diverse",
    };
  }),

  updateSmartQueueSettings: protectedProcedure
    .input(
      z.object({
        autoQueueEnabled: z.boolean().optional(),
        autoQueueThreshold: z.number().min(0).max(10).optional(),
        autoQueueCount: z.number().min(1).max(20).optional(),
        smartMixEnabled: z.boolean().optional(),
        similarityPreference: z
          .enum(["strict", "balanced", "diverse"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, ctx.session.user.id),
      });

      if (!existing) {
        await ctx.db.insert(userPreferences).values({
          userId: ctx.session.user.id,
          ...input,
        });
      } else {
        await ctx.db
          .update(userPreferences)
          .set(input)
          .where(eq(userPreferences.userId, ctx.session.user.id));
      }

      return { success: true };
    }),

  cleanupRecommendationCache: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(recommendationCache)
      .where(lt(recommendationCache.expiresAt, new Date()));

    return { success: true };
  }),

  getCurrentUserProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      userHash: user.userHash,
      admin: user.admin,
      profilePublic: user.profilePublic,
      bio: user.bio,
    };
  }),

  getPublicProfile: publicProcedure
    .input(z.object({ userHash: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return null;
      }

      const [favoriteCount, playlistCount, historyCount] = await Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(favorites)
          .where(eq(favorites.userId, user.id))
          .then((res: Array<{ count: number }>) => res[0]?.count ?? 0),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(playlists)
          .where(
            and(eq(playlists.userId, user.id), eq(playlists.isPublic, true)),
          )
          .then((res: Array<{ count: number }>) => res[0]?.count ?? 0),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(listeningHistory)
          .where(eq(listeningHistory.userId, user.id))
          .then((res: Array<{ count: number }>) => res[0]?.count ?? 0),
      ]);

      return {
        userHash: user.userHash,
        name: user.name,
        image: user.image,
        bio: user.bio,
        stats: {
          favorites: favoriteCount,
          playlists: playlistCount,
          tracksPlayed: historyCount,
        },
      };
    }),

  getPublicListeningHistory: publicProcedure
    .input(z.object({ userHash: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return [];
      }

      const history = await ctx.db.query.listeningHistory.findMany({
        where: eq(listeningHistory.userId, user.id),
        orderBy: desc(listeningHistory.playedAt),
        limit: (input.limit ?? 20) * 3,
      });

      const seenTrackIds = new Set<number>();
      const deduplicated = [];

      for (const h of history) {
        const track = h.trackData as Track;
        if (!seenTrackIds.has(track.id)) {
          seenTrackIds.add(track.id);
          deduplicated.push({
            trackData: h.trackData,
            playedAt: h.playedAt,
          });

          if (deduplicated.length >= (input.limit ?? 20)) {
            break;
          }
        }
      }

      return deduplicated;
    }),

  getPublicFavorites: publicProcedure
    .input(z.object({ userHash: z.string(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return [];
      }

      const favs = await ctx.db.query.favorites.findMany({
        where: eq(favorites.userId, user.id),
        orderBy: desc(favorites.createdAt),
        limit: input.limit ?? 20,
      });

      return favs.map((f: { trackData: unknown }) => f.trackData);
    }),

  getPublicPlaylists: publicProcedure
    .input(z.object({ userHash: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return [];
      }

      const userPlaylists = await ctx.db.query.playlists.findMany({
        where: and(eq(playlists.userId, user.id), eq(playlists.isPublic, true)),
        orderBy: desc(playlists.createdAt),
        with: {
          tracks: {
            limit: 4,
            orderBy: playlistTracks.position,
          },
        },
      });

      return userPlaylists.map(
        (playlist: {
          id: number;
          coverImage: string | null;
          tracks?: Array<{ trackData: unknown }>;
        }) => {
          let coverImage = playlist.coverImage;

          if (!coverImage && playlist.tracks && playlist.tracks.length > 0) {
            const albumCovers = playlist.tracks
              .map((pt: { trackData: unknown }) => {
                const track = pt.trackData as Track;
                return track.album?.cover_medium ?? track.album?.cover;
              })
              .filter(Boolean)
              .slice(0, 4);

            coverImage = JSON.stringify(albumCovers);
          }

          return {
            ...playlist,
            coverImage,
            trackCount: playlist.tracks?.length ?? 0,
          };
        },
      );
    }),

  getPublicTopTracks: publicProcedure
    .input(
      z.object({
        userHash: z.string(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return [];
      }

      const topTracks = await ctx.db
        .select({
          trackId: listeningAnalytics.trackId,
          trackData: listeningAnalytics.trackData,
          playCount: sql<number>`COUNT(*)`,
          totalDuration: sql<number>`SUM(${listeningAnalytics.duration})`,
        })
        .from(listeningAnalytics)
        .where(eq(listeningAnalytics.userId, user.id))
        .groupBy(listeningAnalytics.trackId, listeningAnalytics.trackData)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(input.limit);

      return topTracks.map(
        (item: {
          trackData: unknown;
          playCount: number;
          totalDuration: number | null;
        }) => ({
          track: item.trackData as Track,
          playCount: item.playCount,
          totalDuration: item.totalDuration,
        }),
      );
    }),

  getPublicTopArtists: publicProcedure
    .input(
      z.object({
        userHash: z.string(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.userHash, input.userHash),
      });

      if (!user?.profilePublic) {
        return [];
      }

      const items = await ctx.db
        .select({
          trackData: listeningAnalytics.trackData,
        })
        .from(listeningAnalytics)
        .where(eq(listeningAnalytics.userId, user.id));

      const artistCounts = new Map<
        number,
        { name: string; count: number; artistData: Track["artist"] }
      >();

      for (const item of items) {
        const track = item.trackData as Track;
        const artistId = track.artist.id;

        if (!artistCounts.has(artistId)) {
          artistCounts.set(artistId, {
            name: track.artist.name,
            count: 0,
            artistData: track.artist,
          });
        }

        artistCounts.get(artistId)!.count++;
      }

      return Array.from(artistCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit)
        .map((item) => ({
          artist: item.artistData,
          playCount: item.count,
        }));
    }),

  getCurrentUserHash: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });
    return user?.userHash ?? null;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().optional(),
        profilePublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set(input)
        .where(eq(users.id, ctx.session.user.id));

      return { success: true };
    }),

  getAudioFeatures: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ENABLE_AUDIO_FEATURES) {
        return null;
      }

      const features = await ctx.db.query.audioFeatures.findFirst({
        where: eq(audioFeatures.trackId, input.trackId),
      });

      return features ?? null;
    }),

  getBatchAudioFeatures: protectedProcedure
    .input(z.object({ trackIds: z.array(z.number()).max(50) }))
    .query(async ({ ctx, input }) => {
      if (!ENABLE_AUDIO_FEATURES) {
        return [];
      }

      const features = await Promise.all(
        input.trackIds.map(async (trackId) => {
          const feature = await ctx.db.query.audioFeatures.findFirst({
            where: eq(audioFeatures.trackId, trackId),
          });
          return feature;
        }),
      );

      return features.filter((f: unknown) => f !== undefined);
    }),
});
