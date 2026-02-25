// File: apps/web/src/app/discover/playlists/[id]/page.tsx

"use client";

import EnhancedTrackCard from "@/components/EnhancedTrackCard";
import { LoadingState } from "@starchild/ui/LoadingSpinner";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";
import { isTrack } from "@starchild/types";
import { hapticLight } from "@/utils/haptics";
import { Play, Shuffle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { useEffect, useMemo, useState } from "react";

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    deezer_id: track.deezer_id ?? track.id,
  };
}

function parsePlaylistTracks(payload: unknown): Track[] {
  if (Array.isArray(payload)) {
    return payload.filter(isTrack).map(normalizeTrack);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.tracks)
      ? record.tracks
      : [];

  return rows.filter(isTrack).map(normalizeTrack);
}

export default function DiscoverPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const playlistId = Number.parseInt(id, 10);
  const player = useGlobalPlayer();
  const searchParams = useSearchParams();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const titleFromQuery = useMemo(() => {
    const raw = searchParams.get("title");
    return raw && raw.trim().length > 0 ? raw.trim() : "";
  }, [searchParams]);

  useEffect(() => {
    if (!Number.isFinite(playlistId) || playlistId <= 0) {
      setError("Invalid playlist ID");
      setIsLoading(false);
      return;
    }

    const fetchPlaylist = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/playlist/${playlistId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist: ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        const parsedTracks = parsePlaylistTracks(payload);

        if (parsedTracks.length === 0) {
          throw new Error("This playlist has no playable tracks.");
        }

        setTracks(parsedTracks);
      } catch (err) {
        console.error("Failed to fetch discover playlist:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load playlist tracks",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPlaylist();
  }, [playlistId]);

  const coverUrl =
    tracks[0]?.album.cover_xl ??
    tracks[0]?.album.cover_big ??
    tracks[0]?.album.cover_medium ??
    "/placeholder.png";

  const displayTitle =
    titleFromQuery || (Number.isFinite(playlistId) ? `Playlist #${playlistId}` : "Playlist");

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    hapticLight();
    const [first, ...rest] = tracks;
    if (!first) return;

    player.clearQueue();
    player.playTrack(first);
    if (rest.length > 0) {
      player.addToQueue(rest);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    hapticLight();
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const [first, ...rest] = shuffled;
    if (!first) return;

    player.clearQueue();
    player.playTrack(first);
    if (rest.length > 0) {
      player.addToQueue(rest);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
        <LoadingState message="Loading playlist..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text)]">
            Playlist Not Found
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">{error}</p>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:gap-6">
        <div className="flex-shrink-0">
          <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-xl md:max-w-[300px]">
            <Image
              src={coverUrl}
              alt={displayTitle}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 200px, 300px"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-2 text-sm font-medium text-[var(--color-subtext)]">
            Discover Playlist
          </div>
          <h1 className="mb-2 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            {displayTitle}
          </h1>
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
            <span>
              {tracks.length} track{tracks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
              className="btn-primary touch-target-lg flex items-center gap-2"
            >
              <Play className="h-5 w-5" />
              <span>Play</span>
            </button>
            <button
              onClick={handleShufflePlay}
              disabled={tracks.length === 0}
              className="btn-secondary touch-target-lg flex items-center gap-2"
            >
              <Shuffle className="h-5 w-5" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      {tracks.length > 0 ? (
        <div className="space-y-2">
          {tracks.map((track) => (
            <EnhancedTrackCard
              key={`${track.id}-${track.artist.id}-${track.album.id}`}
              track={track}
              onPlay={player.play}
              onAddToQueue={player.addToQueue}
              showActions={true}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-[var(--color-subtext)]">
          No tracks available for this playlist.
        </div>
      )}
    </div>
  );
}
