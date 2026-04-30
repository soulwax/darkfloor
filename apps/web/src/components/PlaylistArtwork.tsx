// File: apps/web/src/components/PlaylistArtwork.tsx

import {
  getPlaylistArtworkFromCoverImage,
  getPlaylistArtworkFromTracks,
  type PlaylistArtwork as PlaylistArtworkModel,
} from "@/utils/images";
import type { Track } from "@starchild/types";
import { Music } from "lucide-react";
import Image from "next/image";

type PlaylistArtworkTrack = {
  track?: Track | null;
};

type PlaylistArtworkProps = {
  name: string;
  tracks?: PlaylistArtworkTrack[] | null;
  coverImage?: string | null;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
  sizes?: string;
  priority?: boolean;
};

function resolveArtwork({
  coverImage,
  tracks,
}: Pick<PlaylistArtworkProps, "coverImage" | "tracks">): PlaylistArtworkModel {
  const trackArtwork = getPlaylistArtworkFromTracks(tracks);
  if (trackArtwork.type !== "empty") {
    return trackArtwork;
  }

  return getPlaylistArtworkFromCoverImage(coverImage);
}

export function PlaylistArtwork({
  name,
  tracks,
  coverImage,
  className = "relative aspect-square overflow-hidden rounded-lg bg-[var(--color-surface)]",
  imageClassName = "object-cover",
  iconClassName = "h-1/2 w-1/2 text-[var(--color-muted)]",
  sizes = "96px",
  priority = false,
}: PlaylistArtworkProps) {
  const artwork = resolveArtwork({ coverImage, tracks });

  if (artwork.type === "collage") {
    return (
      <div className={`${className} grid grid-cols-2 grid-rows-2 gap-px`}>
        {artwork.sources.map((source, index) => (
          <div key={`${source}-${index}`} className="relative overflow-hidden">
            <Image
              src={source}
              alt={`${name} album ${index + 1}`}
              fill
              sizes={sizes}
              className={imageClassName}
              priority={priority && index === 0}
            />
          </div>
        ))}
      </div>
    );
  }

  if (artwork.type === "single") {
    return (
      <div className={className}>
        <Image
          src={artwork.source}
          alt={name}
          fill
          sizes={sizes}
          className={imageClassName}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center`}>
      <Music className={iconClassName} />
    </div>
  );
}
