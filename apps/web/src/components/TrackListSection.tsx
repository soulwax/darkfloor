// File: apps/web/src/components/TrackListSection.tsx

"use client";

import EnhancedTrackCard from "@/components/EnhancedTrackCard";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";

interface TrackListSectionProps {
  tracks: Track[];
  heading?: string;
  emptyMessage?: string;
}

export function TrackListSection({
  tracks,
  heading,
  emptyMessage = "No tracks available.",
}: TrackListSectionProps) {
  const player = useGlobalPlayer();

  if (tracks.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--color-subtext)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {heading && (
        <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">
          {heading}
        </h2>
      )}
      <div className="space-y-2">
        {tracks.map((track) => (
          <EnhancedTrackCard
            key={track.id}
            track={track}
            onPlay={player.play}
            onAddToQueue={player.addToQueue}
            showActions={true}
          />
        ))}
      </div>
    </div>
  );
}
