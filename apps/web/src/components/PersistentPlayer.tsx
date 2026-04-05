// File: apps/web/src/components/PersistentPlayer.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useEqualizer } from "@/hooks/useEqualizer";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@starchild/api-client/trpc/react";

import { useAudioReactiveBackground } from "@/hooks/useAudioReactiveBackground";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, ListMusic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  SETTINGS_UPDATED_EVENT,
  settingsStorage,
} from "@/utils/settingsStorage";
import {
  getInitialVisualizerEnabledPreference,
  persistVisualizerEnabledPreference,
  readStoredVisualizerEnabled,
  VISUALIZER_PREFERENCE_UPDATED_EVENT,
} from "@/utils/visualizerPreference";
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
const DESKTOP_QUEUE_WIDTH = "min(100vw, 28rem)";

export default function PersistentPlayer() {
  const player = useGlobalPlayer();
  const isMobile = useIsMobile();
  const isElectronRuntime =
    typeof window !== "undefined" && window.electron?.isElectron === true;
  const isTauriDesktop =
    typeof window !== "undefined" && window.starchildTauri?.isTauri === true;
  const shouldDockQueueBelowDesktopHeader = isElectronRuntime || isTauriDesktop;
  const tq = useTranslations("queue");
  const tt = useTranslations("trackMenu");

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
  const [showFpsCounter, setShowFpsCounter] = useState(false);
  const [showPatternControls, setShowPatternControls] = useState(false);
  const [renderer, setRenderer] = useState<FlowFieldRenderer | null>(null);
  const [queuePreferenceOverride, setQueuePreferenceOverride] = useState<
    boolean | null
  >(null);

  // Sync panel state from server preferences - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from server prefs */
  useEffect(() => {
    if (preferences) {
      const persistedQueueOpen = preferences.queuePanelOpen ?? false;
      const nextQueueOpen = queuePreferenceOverride ?? persistedQueueOpen;

      setShowQueue(nextQueueOpen);
      setShowEqualizer(preferences.equalizerPanelOpen ?? false);
      setVisualizerEnabled(preferences.visualizerEnabled ?? true);

      if (
        queuePreferenceOverride !== null &&
        persistedQueueOpen === queuePreferenceOverride
      ) {
        setQueuePreferenceOverride(null);
      }
    }
  }, [preferences, queuePreferenceOverride]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep guest visualizer preference in sync with local storage when signed out.
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: load from localStorage */
  useEffect(() => {
    if (isAuthenticated) return;
    const storedPreference = readStoredVisualizerEnabled();
    setVisualizerEnabled(
      storedPreference ?? getInitialVisualizerEnabledPreference(),
    );
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobile) {
      document.documentElement.style.setProperty(
        "--desktop-right-rail-width",
        "0px",
      );
      return;
    }

    document.documentElement.style.setProperty(
      "--desktop-right-rail-width",
      showQueue ? DESKTOP_QUEUE_WIDTH : "0px",
    );
  }, [isMobile, showQueue]);

  const setQueueOpen = useCallback((next: boolean) => {
    setQueuePreferenceOverride(next);
    setShowQueue(next);
  }, []);

  const toggleQueue = useCallback(() => {
    setShowQueue((prev) => {
      const next = !prev;
      setQueuePreferenceOverride(next);
      return next;
    });
  }, []);

  const persistVisualizerPreference = useCallback(
    (next: boolean) => {
      setVisualizerEnabled(next);
      if (isAuthenticated) {
        updatePreferences.mutate({ visualizerEnabled: next });
      } else if (typeof window !== "undefined") {
        persistVisualizerEnabledPreference(next);
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

  useEffect(() => {
    if (typeof window === "undefined" || isAuthenticated) return;

    const syncGuestPreference = () => {
      const storedPreference = readStoredVisualizerEnabled();
      if (storedPreference !== null) {
        setVisualizerEnabled(storedPreference);
      }
    };

    syncGuestPreference();
    window.addEventListener(
      VISUALIZER_PREFERENCE_UPDATED_EVENT,
      syncGuestPreference,
    );

    return () => {
      window.removeEventListener(
        VISUALIZER_PREFERENCE_UPDATED_EVENT,
        syncGuestPreference,
      );
    };
  }, [isAuthenticated]);

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
    onToggleQueue: toggleQueue,
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
          <button
            type="button"
            onClick={toggleQueue}
            className="theme-panel pointer-events-auto fixed top-1/2 z-[61] hidden -translate-y-1/2 items-center rounded-l-lg border border-r-0 px-1.5 py-2 text-[var(--color-muted)] shadow-none transition-colors hover:bg-white/4 hover:text-[var(--color-text)] md:flex"
            style={{
              right: showQueue
                ? "calc(var(--desktop-right-rail-width, 0px) + var(--desktop-window-edge-offset, 0px) + 0.35rem)"
                : "calc(var(--desktop-window-edge-offset, 0px) + 0.35rem)",
            }}
            aria-label={showQueue ? tq("closeQueue") : tt("queue")}
            title={showQueue ? tq("closeQueue") : tt("queue")}
            aria-pressed={showQueue}
          >
            <div className="flex flex-col items-center gap-1">
              {showQueue ? (
                <ChevronRight className="h-3 w-3 text-[var(--color-subtext)]" />
              ) : (
                <ChevronLeft className="h-3 w-3 text-[var(--color-subtext)]" />
              )}
              <ListMusic className="h-3.5 w-3.5 opacity-85" />
              <span
                className="text-[9px] font-medium opacity-85"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                {tt("queue")}
              </span>
            </div>
          </button>

          <div
            className={`pointer-events-none fixed bottom-0 z-50 w-[calc(100vw-2rem)] max-w-[56rem] -translate-x-1/2 px-4 pb-4 xl:max-w-[60rem] ${
              isTauriDesktop ? "tauri-player-dock" : ""
            }`}
            style={{
              left: "50%",
            }}
          >
            <div className="player-backdrop pointer-events-auto overflow-hidden rounded-[1.35rem]">
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
              onClose={() => setQueueOpen(false)}
              onRemove={player.removeFromQueue}
              onClear={player.clearQueue}
              onReorder={player.reorderQueue}
              onPlayFrom={player.playFromQueue}
              onSaveAsPlaylist={player.saveQueueAsPlaylist}
              onAddSmartTracks={player.addSmartTracks}
              onRefreshSmartTracks={player.refreshSmartTracks}
              onClearSmartTracks={player.clearSmartTracks}
              dockBelowDesktopHeader={shouldDockQueueBelowDesktopHeader}
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
            onToggleQueue={() => setQueueOpen(true)}
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
              onToggleQueue={toggleQueue}
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
              onClose={() => setQueueOpen(false)}
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
