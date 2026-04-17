import type { Track } from "@starchild/types";

export type M3u8PlaylistEntry = {
  index: number;
  lineNumber: number;
  durationSeconds: number | null;
  rawTitle: string | null;
  uri: string;
  artist: string | null;
  title: string;
  query: string;
  deezerTrackId: number | null;
};

export type M3u8PlaylistParseResult = {
  name: string;
  entries: M3u8PlaylistEntry[];
  skippedLineCount: number;
};

type PendingExtinf = {
  durationSeconds: number | null;
  rawTitle: string | null;
};

const AUDIO_EXTENSION_PATTERN =
  /\.(?:aac|aif|aiff|alac|flac|m4a|m4p|mp3|mp4|ogg|opus|wav|webm|wma)$/i;
const PLAYLIST_EXTENSION_PATTERN = /\.(?:m3u8?|pls)$/i;
const HLS_SEGMENT_PATTERN = /\.(?:ts|m4s|cmfv|cmfa|key|vtt)$/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getNameFromPath(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0] ?? value;
  const normalizedPath = withoutQuery.replace(/\\/g, "/");
  const segment = normalizedPath.split("/").filter(Boolean).at(-1) ?? "";
  const decoded = safeDecodeURIComponent(segment);

  return normalizeWhitespace(
    decoded
      .replace(AUDIO_EXTENSION_PATTERN, "")
      .replace(PLAYLIST_EXTENSION_PATTERN, "")
      .replace(/[_]+/g, " ")
      .replace(/\s+-\s+/g, " - "),
  );
}

function getPlaylistName(fileName: string | undefined): string {
  const rawName = fileName ? getNameFromPath(fileName) : "";
  return rawName || "Imported M3U8 Playlist";
}

function parseExtinf(line: string): PendingExtinf | null {
  const match = /^#EXTINF\s*:\s*([^,]*)(?:,(.*))?$/i.exec(line);
  if (!match) return null;

  const durationCandidate = Number.parseFloat(match[1]?.trim() ?? "");
  const durationSeconds =
    Number.isFinite(durationCandidate) && durationCandidate >= 0
      ? durationCandidate
      : null;
  const rawTitle = normalizeWhitespace(match[2] ?? "");

  return {
    durationSeconds,
    rawTitle: rawTitle.length > 0 ? rawTitle : null,
  };
}

function splitArtistAndTitle(label: string): {
  artist: string | null;
  title: string;
} {
  const normalized = normalizeWhitespace(label);
  const separatorMatch = /\s(?:-|–|—)\s/.exec(normalized);

  if (!separatorMatch || separatorMatch.index <= 0) {
    return { artist: null, title: normalized };
  }

  const artist = normalizeWhitespace(normalized.slice(0, separatorMatch.index));
  const title = normalizeWhitespace(
    normalized.slice(separatorMatch.index + separatorMatch[0].length),
  );

  if (!artist || !title) {
    return { artist: null, title: normalized };
  }

  return { artist, title };
}

function extractDeezerTrackId(value: string): number | null {
  const candidates = [
    /deezer:track:(\d+)/i,
    /(?:api\.)?deezer\.com\/(?:[a-z]{2}\/)?track\/(\d+)/i,
  ];

  for (const pattern of candidates) {
    const match = pattern.exec(value);
    const parsed = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function isLikelyHlsSegment(uri: string): boolean {
  const path = uri.split(/[?#]/, 1)[0] ?? uri;
  return HLS_SEGMENT_PATTERN.test(path);
}

function buildEntry(
  uri: string,
  pendingExtinf: PendingExtinf | null,
  index: number,
  lineNumber: number,
): M3u8PlaylistEntry | null {
  const rawTitle = pendingExtinf?.rawTitle ?? null;
  const deezerTrackId = extractDeezerTrackId(uri);
  const fallbackTitle = getNameFromPath(uri);
  const titleSource = rawTitle ?? fallbackTitle;

  if (!titleSource && deezerTrackId === null) {
    return null;
  }

  if (!rawTitle && deezerTrackId === null && isLikelyHlsSegment(uri)) {
    return null;
  }

  const { artist, title } = splitArtistAndTitle(titleSource || uri);
  const query = normalizeWhitespace([artist, title].filter(Boolean).join(" "));

  return {
    index,
    lineNumber,
    durationSeconds: pendingExtinf?.durationSeconds ?? null,
    rawTitle,
    uri,
    artist,
    title,
    query,
    deezerTrackId,
  };
}

export function parseM3u8Playlist(
  content: string,
  fileName?: string,
): M3u8PlaylistParseResult {
  const entries: M3u8PlaylistEntry[] = [];
  let pendingExtinf: PendingExtinf | null = null;
  let skippedLineCount = 0;

  const normalizedContent = content.replace(/^\uFEFF/, "");
  const lines = normalizedContent.split(/\r?\n/);

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;

    const extinf = parseExtinf(line);
    if (extinf) {
      pendingExtinf = extinf;
      return;
    }

    if (line.startsWith("#")) {
      return;
    }

    const entry = buildEntry(
      line,
      pendingExtinf,
      entries.length,
      lineIndex + 1,
    );
    pendingExtinf = null;

    if (entry) {
      entries.push(entry);
    } else {
      skippedLineCount += 1;
    }
  });

  return {
    name: getPlaylistName(fileName),
    entries,
    skippedLineCount,
  };
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .trim();
}

function trackMatchesDeezerId(track: Track, deezerTrackId: number): boolean {
  const candidateIds = [track.id, track.deezer_id]
    .map((id) => (typeof id === "string" ? Number.parseInt(id, 10) : id))
    .filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id),
    );

  return candidateIds.includes(deezerTrackId);
}

function scoreTrackMatch(entry: M3u8PlaylistEntry, track: Track): number {
  if (
    entry.deezerTrackId !== null &&
    trackMatchesDeezerId(track, entry.deezerTrackId)
  ) {
    return 1_000;
  }

  const entryTitle = normalizeForMatch(entry.title);
  const entryArtist = normalizeForMatch(entry.artist);
  const trackTitle = normalizeForMatch(track.title);
  const trackShortTitle = normalizeForMatch(track.title_short);
  const trackArtist = normalizeForMatch(track.artist.name);

  let score = 0;

  if (
    entryTitle &&
    (entryTitle === trackTitle || entryTitle === trackShortTitle)
  ) {
    score += 60;
  } else if (
    entryTitle &&
    (trackTitle.includes(entryTitle) || entryTitle.includes(trackTitle))
  ) {
    score += 35;
  }

  if (entryArtist && entryArtist === trackArtist) {
    score += 35;
  } else if (
    entryArtist &&
    (trackArtist.includes(entryArtist) || entryArtist.includes(trackArtist))
  ) {
    score += 18;
  }

  score += Math.min(5, Math.max(0, track.rank) / 200_000);

  return score;
}

export function selectBestM3u8TrackMatch(
  entry: M3u8PlaylistEntry,
  tracks: Track[],
): Track | null {
  let bestTrack: Track | null = null;
  let bestScore = -1;

  for (const track of tracks) {
    const score = scoreTrackMatch(entry, track);
    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  }

  return bestScore >= 20 ? bestTrack : null;
}
