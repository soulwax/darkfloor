// File: apps/web/src/components/TrackPlayButtons.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import type { Track } from "@starchild/types";
import { hapticLight } from "@/utils/haptics";
import { Play, Shuffle } from "lucide-react";

interface TrackPlayButtonsProps {
  tracks: Track[];
}

export function TrackPlayButtons({ tracks }: TrackPlayButtonsProps) {
  const player = useGlobalPlayer();

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    hapticLight();
    const [first, ...rest] = tracks;
    if (first) {
      player.clearQueue();
      player.playTrack(first);
      if (rest.length > 0) player.addToQueue(rest);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    hapticLight();
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const [first, ...rest] = shuffled;
    if (first) {
      player.clearQueue();
      player.playTrack(first);
      if (rest.length > 0) player.addToQueue(rest);
    }
  };

  return (
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
  );
}
