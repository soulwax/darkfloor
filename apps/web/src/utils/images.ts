// File: apps/web/src/utils/images.ts

import type { Album, Artist, Track } from "@starchild/types";

export type PlaylistArtwork =
  | { type: "collage"; sources: string[] }
  | { type: "single"; source: string }
  | { type: "empty" };

type PlaylistArtworkTrack = {
  track?: Track | null;
};

const PLACEHOLDER_COVER = "/images/placeholder-cover.svg";

const normalizeImageUrl = (value?: string | null): string | undefined =>
  value && value.trim().length > 0 ? value : undefined;

export function getCoverImage(
  track: Track,
  size: "small" | "medium" | "big" | "xl" = "medium",
): string {
  const album = track.album;

  if (!album) {
    return PLACEHOLDER_COVER;
  }

  const sizeMap = {
    small: normalizeImageUrl(album.cover_small),
    medium: normalizeImageUrl(album.cover_medium),
    big: normalizeImageUrl(album.cover_big),
    xl: normalizeImageUrl(album.cover_xl),
  };

  return (
    sizeMap[size] ??
    normalizeImageUrl(album.cover_medium) ??
    normalizeImageUrl(album.cover_small) ??
    normalizeImageUrl(album.cover) ??
    PLACEHOLDER_COVER
  );
}

export function getAlbumCover(
  album: Album,
  size: "small" | "medium" | "big" | "xl" = "medium",
): string {
  const sizeMap = {
    small: normalizeImageUrl(album.cover_small),
    medium: normalizeImageUrl(album.cover_medium),
    big: normalizeImageUrl(album.cover_big),
    xl: normalizeImageUrl(album.cover_xl),
  };

  return (
    sizeMap[size] ??
    normalizeImageUrl(album.cover_medium) ??
    normalizeImageUrl(album.cover_small) ??
    normalizeImageUrl(album.cover) ??
    PLACEHOLDER_COVER
  );
}

export function getArtistPicture(
  artist: Artist,
  size: "small" | "medium" | "big" | "xl" = "medium",
): string {
  const sizeMap = {
    small: normalizeImageUrl(artist.picture_small),
    medium: normalizeImageUrl(artist.picture_medium),
    big: normalizeImageUrl(artist.picture_big),
    xl: normalizeImageUrl(artist.picture_xl),
  };

  return (
    sizeMap[size] ??
    normalizeImageUrl(artist.picture_medium) ??
    normalizeImageUrl(artist.picture_small) ??
    normalizeImageUrl(artist.picture) ??
    PLACEHOLDER_COVER
  );
}

export function getPlaylistArtworkFromTracks(
  tracks: PlaylistArtworkTrack[] | null | undefined,
): PlaylistArtwork {
  if (!tracks || tracks.length === 0) {
    return { type: "empty" };
  }

  const firstCover = tracks[0]?.track ? getCoverImage(tracks[0].track) : null;
  const distinctAlbumCovers: string[] = [];
  const seenAlbumKeys = new Set<string>();

  for (const item of tracks) {
    const track = item.track;
    const album = track?.album;
    if (!track || !album) continue;

    const cover = getCoverImage(track);
    if (!cover || cover === PLACEHOLDER_COVER) continue;

    const albumKey = String(album.id ?? album.md5_image ?? cover);
    if (seenAlbumKeys.has(albumKey)) continue;

    seenAlbumKeys.add(albumKey);
    distinctAlbumCovers.push(cover);

    if (distinctAlbumCovers.length === 4) {
      break;
    }
  }

  if (distinctAlbumCovers.length === 4) {
    return { type: "collage", sources: distinctAlbumCovers };
  }

  if (firstCover) {
    return { type: "single", source: firstCover };
  }

  return { type: "empty" };
}

export function getPlaylistArtworkFromCoverImage(
  coverImage: string | null | undefined,
): PlaylistArtwork {
  const normalizedCover = normalizeImageUrl(coverImage);
  if (!normalizedCover) {
    return { type: "empty" };
  }

  if (!normalizedCover.startsWith("[")) {
    return { type: "single", source: normalizedCover };
  }

  try {
    const parsed: unknown = JSON.parse(normalizedCover);
    if (!Array.isArray(parsed)) {
      return { type: "empty" };
    }

    const sources = parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (sources.length >= 4) {
      return { type: "collage", sources: sources.slice(0, 4) };
    }

    return sources[0]
      ? { type: "single", source: sources[0] }
      : { type: "empty" };
  } catch {
    return { type: "empty" };
  }
}

export function getImageSrcSet(album: Album): string {
  const sizes = [];

  if (album.cover_small) {
    sizes.push(`${album.cover_small} 56w`);
  }
  if (album.cover_medium) {
    sizes.push(`${album.cover_medium} 250w`);
  }
  if (album.cover_big) {
    sizes.push(`${album.cover_big} 500w`);
  }
  if (album.cover_xl) {
    sizes.push(`${album.cover_xl} 1000w`);
  }

  return sizes.join(", ");
}
