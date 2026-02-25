// File: apps/web/src/components/PersistentPlayer.tsx

"use client";

import { STORAGE_KEYS } from "@starchild/config/storage";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useEqualizer } from "@/hooks/useEqualizer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@starchild/api-client/trpc/react";

import { useAudioReactiveBackground } from "@/hooks/useAudioReactiveBackground";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  SETTINGS_UPDATED_EVENT,
  settingsStorage,
} from "@/utils/settingsStorage";
import { LightweightParticleBackground } from "./LightweightParticleBackground";
import MaturePlayer from "./Player";
import type { FlowFieldRenderer } from "@starchild/visualizers/FlowFieldRenderer";
import { VISUALIZER_SHORTCUT_TOGGLE_EVENT } from "@/contexts/KeyboardShortcutsProvider";

const FlowFieldBackground = dynamic(
  () =>
    import("./FlowFieldBackground").then((mod) => ({
      default: mod.FlowFieldBackground,
    })),
  { ssr: false },
);

const PatternControls = dynamic(
  () => import("./PatternControls").then((mod) => ({ default: mod.default })),
  { ssr: false },
);

const Equalizer = dynamic(
  () => import("./Equalizer").then((mod) => mod.Equalizer),
  { ssr: false },
);

const EnhancedQueue = dynamic(
  () => import("./EnhancedQueue").then((mod) => mod.EnhancedQueue),
  { ssr: false },
);

const MobilePlayer = dynamic(() => import("./MobilePlayer"), { ssr: false });
const MiniPlayer = dynamic(() => import("./MiniPlayer"), { ssr: false });

export default function PersistentPlayer() {
  const player = useGlobalPlayer();
  const isMobile = useIsMobile();

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const { data: preferences } = api.music.getUserPreferences.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    },
  );

  const updatePreferences = api.music.updatePreferences.useMutation();

  const equalizer = useEqualizer(player.audioElement);

  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [showFpsCounter, setShowFpsCounter] = useState(() =>
    settingsStorage.getSetting("showFpsCounter", false),
  );
  const [showPatternControls, setShowPatternControls] = useState(false);
  const [renderer, setRenderer] = useState<FlowFieldRenderer | null>(null);

  // Sync panel state from server preferences - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from server prefs */
  useEffect(() => {
    if (preferences) {
      setShowQueue(preferences.queuePanelOpen ?? false);
      setShowEqualizer(preferences.equalizerPanelOpen ?? false);
      setVisualizerEnabled(preferences.visualizerEnabled ?? true);
    }
  }, [preferences]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load visualizer state from localStorage when not authenticated
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: load from localStorage */
  useEffect(() => {
    if (isAuthenticated) return;
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(STORAGE_KEYS.VISUALIZER_ENABLED);
    if (stored !== null) {
      try {
        const parsed: unknown = JSON.parse(stored);
        setVisualizerEnabled(parsed === true);
      } catch {
        setVisualizerEnabled(stored === "true");
      }
    }
  }, [isAuthenticated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useAudioReactiveBackground(
    player.audioElement,
    player.isPlaying,
    visualizerEnabled,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFpsCounterPreference = () => {
      setShowFpsCounter(settingsStorage.getSetting("showFpsCounter", false));
    };

    syncFpsCounterPreference();
    window.addEventListener(SETTINGS_UPDATED_EVENT, syncFpsCounterPreference);

    return () => {
      window.removeEventListener(
        SETTINGS_UPDATED_EVENT,
        syncFpsCounterPreference,
      );
    };
  }, []);

  useEffect(() => {
    if (
      isAuthenticated &&
      preferences &&
      showQueue !== preferences.queuePanelOpen
    ) {
      updatePreferences.mutate({ queuePanelOpen: showQueue });
    }
  }, [showQueue, isAuthenticated, preferences, updatePreferences]);

  useEffect(() => {
    if (
      isAuthenticated &&
      preferences &&
      showEqualizer !== preferences.equalizerPanelOpen
    ) {
      updatePreferences.mutate({ equalizerPanelOpen: showEqualizer });
    }
  }, [showEqualizer, isAuthenticated, preferences, updatePreferences]);

  const persistVisualizerPreference = useCallback(
    (next: boolean) => {
      setVisualizerEnabled(next);
      if (isAuthenticated) {
        updatePreferences.mutate({ visualizerEnabled: next });
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(
          STORAGE_KEYS.VISUALIZER_ENABLED,
          JSON.stringify(next),
        );
      }
    },
    [isAuthenticated, updatePreferences],
  );

  const handleVisualizerToggle = useCallback(() => {
    const next = !visualizerEnabled;
    persistVisualizerPreference(next);

  }, [persistVisualizerPreference, visualizerEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleShortcutToggle = () => {
      handleVisualizerToggle();
    };

    window.addEventListener(
      VISUALIZER_SHORTCUT_TOGGLE_EVENT,
      handleShortcutToggle,
    );

    return () => {
      window.removeEventListener(
        VISUALIZER_SHORTCUT_TOGGLE_EVENT,
        handleShortcutToggle,
      );
    };
  }, [handleVisualizerToggle]);

  const playerProps = {
    currentTrack: player.currentTrack,
    queue: player.queue,
    isPlaying: player.isPlaying,
    currentTime: player.currentTime,
    duration: player.duration,
    volume: player.volume,
    isMuted: player.isMuted,
    isShuffled: player.isShuffled,
    repeatMode: player.repeatMode,
    isLoading: player.isLoading,
    onPlayPause: player.togglePlay,
    onNext: player.playNext,
    onPrevious: player.playPrevious,
    onSeek: player.seek,
    onVolumeChange: player.setVolume,
    onToggleMute: () => player.setIsMuted(!player.isMuted),
    onToggleShuffle: player.toggleShuffle,
    onCycleRepeat: player.cycleRepeatMode,
    onSkipForward: player.skipForward,
    onSkipBackward: player.skipBackward,
    onToggleQueue: () => setShowQueue(!showQueue),
    onToggleEqualizer: () => setShowEqualizer(!showEqualizer),
    onToggleVisualizer: !isMobile ? handleVisualizerToggle : undefined,
    visualizerEnabled,
    onTogglePatternControls: !isMobile
      ? () => setShowPatternControls(!showPatternControls)
      : undefined,
  };

  return (
    <>
      {}
      {!isMobile && (
        <>
          <div
            className="pointer-events-none fixed bottom-0 z-50 px-4 pb-4"
            style={{
              left: "var(--electron-sidebar-width, 0px)",
              right: "var(--desktop-right-rail-width, 0px)",
            }}
          >
            <div className="player-backdrop pointer-events-auto mx-auto max-w-5xl overflow-hidden rounded-2xl">
              <div className="player-backdrop-inner">
                <MaturePlayer {...playerProps} />
              </div>
            </div>
          </div>

          {}
          {showQueue && (
            <EnhancedQueue
              queue={player.queue}
              queuedTracks={player.queuedTracks}
              smartQueueState={player.smartQueueState}
              currentTrack={player.currentTrack}
              onClose={() => setShowQueue(false)}
              onRemove={player.removeFromQueue}
              onClear={player.clearQueue}
              onReorder={player.reorderQueue}
              onPlayFrom={player.playFromQueue}
              onSaveAsPlaylist={player.saveQueueAsPlaylist}
              onAddSmartTracks={player.addSmartTracks}
              onRefreshSmartTracks={player.refreshSmartTracks}
              onClearSmartTracks={player.clearSmartTracks}
            />
          )}
        </>
      )}

      {}
      {isMobile && player.currentTrack && (
        <>
          {}
          <MiniPlayer
            currentTrack={player.currentTrack}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            queue={player.queue}
            lastAutoQueueCount={player.lastAutoQueueCount}
            onPlayPause={player.togglePlay}
            onNext={player.playNext}
            onSeek={player.seek}
            onTap={() => player.setShowMobilePlayer(true)}
            onToggleQueue={() => setShowQueue(true)}
          />

          {}
          {player.showMobilePlayer && (
            <MobilePlayer
              currentTrack={player.currentTrack}
              queue={player.queue}
              isPlaying={player.isPlaying}
              currentTime={player.currentTime}
              duration={player.duration}
              isMuted={player.isMuted}
              isShuffled={player.isShuffled}
              repeatMode={player.repeatMode}
              isLoading={player.isLoading}
              onPlayPause={player.togglePlay}
              onNext={player.playNext}
              onPrevious={player.playPrevious}
              onSeek={player.seek}
              onToggleMute={() => player.setIsMuted(!player.isMuted)}
              onToggleShuffle={player.toggleShuffle}
              onCycleRepeat={player.cycleRepeatMode}
              onSkipForward={player.skipForward}
              onSkipBackward={player.skipBackward}
              onToggleQueue={() => setShowQueue(!showQueue)}
              onClose={() => player.setShowMobilePlayer(false)}
              forceExpanded={true}
            />
          )}

          {}
          {showQueue && (
            <EnhancedQueue
              queue={player.queue}
              queuedTracks={player.queuedTracks}
              smartQueueState={player.smartQueueState}
              currentTrack={player.currentTrack}
              onClose={() => setShowQueue(false)}
              onRemove={player.removeFromQueue}
              onClear={player.clearQueue}
              onReorder={player.reorderQueue}
              onPlayFrom={player.playFromQueue}
              onSaveAsPlaylist={player.saveQueueAsPlaylist}
              onAddSmartTracks={player.addSmartTracks}
              onRefreshSmartTracks={player.refreshSmartTracks}
              onClearSmartTracks={player.clearSmartTracks}
            />
          )}
        </>
      )}

      {}
      {showEqualizer && (
        <Equalizer
          equalizer={equalizer}
          onClose={() => setShowEqualizer(false)}
        />
      )}

      {}
      {player.currentTrack && visualizerEnabled && !isMobile && (
        <FlowFieldBackground
          audioElement={player.audioElement}
          showFpsCounter={showFpsCounter}
          onRendererReady={setRenderer}
        />
      )}

      {}
      {!isMobile && showPatternControls && (
        <PatternControls
          renderer={renderer}
          onClose={() => setShowPatternControls(false)}
        />
      )}

      {}
      {(isMobile || !visualizerEnabled) && <LightweightParticleBackground />}
    </>
  );
}
