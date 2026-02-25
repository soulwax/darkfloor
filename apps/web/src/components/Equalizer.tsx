// File: apps/web/src/components/Equalizer.tsx

"use client";

import type { useEqualizer } from "@/hooks/useEqualizer";
import {
    haptic,
    hapticLight,
    hapticMedium,
    hapticSliderContinuous,
    hapticSliderEnd,
} from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import { motion, type PanInfo } from "framer-motion";
import { Power, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface EqualizerProps {
  equalizer: ReturnType<typeof useEqualizer>;
  onClose: () => void;
}

interface VerticalEqSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled: boolean;
  isHovered: boolean;
  isAnimating: boolean;
  isEnabled: boolean;
}

function VerticalEqSlider({
  value,
  min,
  max,
  onChange,
  disabled,
  isHovered,
  isAnimating,
  isEnabled,
}: VerticalEqSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const calculateValue = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const y = clientY - rect.top;
      const pct = 1 - y / rect.height;
      const clampedPct = Math.max(0, Math.min(1, pct));
      return min + clampedPct * (max - min);
    },
    [max, min, value],
  );

  const handleDragStart = useCallback(() => {
    if (disabled) return;
    setIsDragging(true);
    haptic("selection");
  }, [disabled]);

  const handleDrag = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled || !trackRef.current) return;
      const newValue = calculateValue(info.point.y);
      const snappedValue = Math.round(newValue * 2) / 2;
      onChange(snappedValue);
      hapticSliderContinuous(snappedValue, min, max, {
        intervalMs: 35,
        tickThreshold: 1,
        boundaryFeedback: true,
      });
    },
    [calculateValue, disabled, max, min, onChange],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    hapticSliderEnd();
  }, []);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const newValue = calculateValue(e.clientY);
      const snappedValue = Math.round(newValue * 2) / 2;
      onChange(snappedValue);
      haptic("selection");
    },
    [calculateValue, disabled, onChange],
  );

  const handleTrackTouch = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      const newValue = calculateValue(touch.clientY);
      const snappedValue = Math.round(newValue * 2) / 2;
      onChange(snappedValue);
      hapticSliderContinuous(snappedValue, min, max, {
        intervalMs: 35,
        tickThreshold: 1,
        boundaryFeedback: true,
      });
    },
    [calculateValue, disabled, max, min, onChange],
  );

  return (
    <div
      ref={trackRef}
      className="relative h-full w-6 cursor-pointer sm:w-7 md:w-8"
      onClick={handleTrackClick}
      onTouchMove={handleTrackTouch}
      onTouchStart={() => {
        if (!disabled) {
          setIsDragging(true);
          haptic("selection");
        }
      }}
      onTouchEnd={() => {
        setIsDragging(false);
        hapticSliderEnd();
      }}
    >
      {}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`relative h-full w-1.5 overflow-hidden rounded-full ${
            isEnabled ? "bg-[rgba(244,178,102,0.08)]" : "bg-[rgba(255,255,255,0.05)]"
          } ${isAnimating ? "animate-pulse" : ""}`}
        >
          {}
          {isEnabled && value !== 0 && (
            <motion.div
              className="absolute inset-x-0 blur-md"
              animate={{
                height: `${Math.abs(percentage - 50)}%`,
                top: percentage < 50 ? "50%" : "auto",
                bottom: percentage >= 50 ? "50%" : "auto",
              }}
              style={{
                background: `linear-gradient(${
                  percentage >= 50 ? "to bottom" : "to top"
                }, rgba(244, 178, 102, ${(Math.abs(value) / 12) * 0.7}), rgba(88, 198, 177, ${(Math.abs(value) / 12) * 0.7}))`,
              }}
              transition={springPresets.slider}
            />
          )}

          {}
          <motion.div
            className={`absolute inset-x-0 rounded-sm ${
              !isEnabled
                ? "bg-[rgba(255,255,255,0.15)]"
                : "bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))] shadow-lg"
            }`}
            animate={{
              height: `${Math.abs(percentage - 50)}%`,
              top: percentage < 50 ? "50%" : "auto",
              bottom: percentage >= 50 ? "50%" : "auto",
              boxShadow: isHovered || isDragging ? "0 0 18px rgba(244,178,102,0.35)" : "none",
            }}
            transition={springPresets.slider}
          />

          {}
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/30" />
        </div>
      </div>

      {}
      <motion.div
        className="absolute left-1/2 z-10 cursor-grab active:cursor-grabbing"
        style={{ x: "-50%" }}
        animate={{
          bottom: `${percentage}%`,
          y: "50%",
          scale: isDragging ? 1.3 : isHovered ? 1.15 : 1,
        }}
        drag="y"
        dragConstraints={trackRef}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        transition={springPresets.sliderThumb}
      >
        <motion.div
          className={`h-4 w-4 rounded-full shadow-lg ${
            isEnabled
              ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              : "bg-[rgba(255,255,255,0.5)]"
          }`}
          animate={{
            scale: isDragging ? 1.2 : 1,
          }}
          transition={springPresets.sliderThumb}
        >
          {isDragging && isEnabled && (
            <motion.div
              className="absolute inset-0 rounded-full bg-[var(--color-accent)]"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export function Equalizer({ equalizer, onClose }: EqualizerProps) {
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!equalizer.isInitialized && equalizer.isSupported) {
      const handleInteraction = () => {
        equalizer.initialize();
      };

      document.addEventListener("click", handleInteraction, { once: true });

      return () => {
        document.removeEventListener("click", handleInteraction);
      };
    }
  }, [equalizer]);

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${freq / 1000}k`;
    }
    return freq.toString();
  };

  const handlePresetChange = (preset: string) => {
    if (!equalizer.isSupported) return;
    hapticMedium();
    setIsAnimating(true);
    equalizer.applyPreset(preset);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const handleToggle = () => {
    if (!equalizer.isSupported) return;
    hapticMedium();
    equalizer.toggle();
  };

  const handleReset = () => {
    hapticLight();
    setIsAnimating(true);
    equalizer.reset();
    setTimeout(() => setIsAnimating(false), 600);
  };

  const handleClose = () => {
    hapticLight();
    onClose();
  };

  return (
    <>
      {}
      <div
        className="theme-chrome-backdrop fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {}
      <div className="animate-in slide-in-from-left fixed top-4 left-4 z-50 max-h-[calc(100vh-180px)] w-full max-w-md duration-300 sm:top-20 sm:left-6 sm:max-w-lg">
        <div className="theme-chrome-drawer relative flex h-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl">
          {}
          {equalizer.isEnabled && (
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute top-0 left-1/2 h-full w-1/2 -translate-x-1/2 bg-[radial-gradient(circle_at_top,rgba(244,178,102,0.4),rgba(88,198,177,0.25),transparent_75%)] blur-3xl" />
            </div>
          )}

          <div className="flex h-full flex-col overflow-hidden">
            {}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] shadow-[var(--accent-btn-shadow)]">
                  <Sparkles className="h-4 w-4 text-[var(--color-on-accent)]" />
                </div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  Equalizer
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReset}
                  className="group rounded-lg p-2 text-[var(--color-subtext)] transition-all hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)] active:scale-95"
                  title="Reset to flat"
                >
                  <RotateCcw className="h-4 w-4 transition-transform group-hover:rotate-180" />
                </button>
                <button
                  onClick={handleToggle}
                  disabled={!equalizer.isSupported}
                  className={`group relative rounded-lg p-2 transition-all active:scale-95 ${
                    equalizer.isEnabled && equalizer.isSupported
                      ? "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-[var(--color-text)] shadow-[var(--accent-btn-shadow)]"
                      : "text-[var(--color-subtext)] hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)]"
                  } ${!equalizer.isSupported ? "cursor-not-allowed opacity-50" : ""}`}
                  title={
                    !equalizer.isSupported
                      ? "Equalizer unavailable on iOS Safari"
                      : equalizer.isEnabled
                        ? "Disable EQ"
                        : "Enable EQ"
                  }
                >
                  <Power className="h-4 w-4" />
                  {equalizer.isEnabled && equalizer.isSupported && (
                    <span className="absolute inset-0 animate-ping rounded-lg bg-[rgba(244,178,102,0.4)] opacity-30" />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-2 text-[var(--color-subtext)] transition-all hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)] active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!equalizer.isSupported ? (
                <div className="flex items-center justify-center p-12 text-center">
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)]">
                      <Power className="h-8 w-8 text-[var(--color-subtext)]" />
                    </div>
                    <p className="text-sm text-[var(--color-text)]">
                      Equalizer unavailable on iOS Safari
                    </p>
                    <p className="text-xs text-[var(--color-subtext)]">
                      Disabled to keep background playback running.
                    </p>
                  </div>
                </div>
              ) : !equalizer.isInitialized ? (
                <div className="flex items-center justify-center p-12 text-center">
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] shadow-[var(--accent-btn-shadow-hover)]">
                      <Sparkles className="h-8 w-8 animate-pulse text-[var(--color-on-accent)]" />
                    </div>
                    <p className="text-sm text-[var(--color-text)]">
                      Click anywhere to enable equalizer
                    </p>
                    <p className="text-xs text-[var(--color-subtext)]">
                      Web Audio API requires user interaction
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {}
                  <div className="relative border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
                    <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--color-subtext)] uppercase">
                      Preset
                    </label>
                    <select
                      value={equalizer.currentPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)] backdrop-blur-sm transition-all hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25 focus:outline-none"
                    >
                      {equalizer.presets.map((preset) => (
                        <option
                          key={preset.name}
                          value={preset.name}
                          className="bg-[var(--color-bg)] text-[var(--color-text)]"
                        >
                          {preset.name}
                        </option>
                      ))}
                      {equalizer.currentPreset === "Custom" && (
                        <option
                          value="Custom"
                          className="bg-[var(--color-bg)] text-[var(--color-text)]"
                        >
                          Custom
                        </option>
                      )}
                    </select>
                  </div>

                  {}
                  <div className="relative p-4 sm:p-6">
                    <div className="flex items-end justify-between gap-1.5 sm:gap-2 md:gap-3">
                      {equalizer.bands.map((band, index) => {
                        const isHovered = hoveredBand === index;

                        return (
                          <div
                            key={band.frequency}
                            className="group relative flex flex-1 flex-col items-center gap-2"
                            onMouseEnter={() => setHoveredBand(index)}
                            onMouseLeave={() => setHoveredBand(null)}
                          >
                            {}
                            <div className="relative">
                              <span
                                className={`text-[10px] font-bold transition-all duration-200 sm:text-xs ${
                                  equalizer.isEnabled && band.gain !== 0
                                    ? "text-[var(--color-text)]"
                                    : "text-[var(--color-muted)]"
                                } ${isHovered ? "scale-110" : ""}`}
                              >
                                {band.gain > 0 ? "+" : ""}
                                {band.gain.toFixed(1)}
                              </span>
                              {equalizer.isEnabled && band.gain !== 0 && (
                                <span className="absolute inset-0 animate-pulse text-[10px] font-bold text-[var(--color-accent)] opacity-50 blur-sm sm:text-xs">
                                  {band.gain > 0 ? "+" : ""}
                                  {band.gain.toFixed(1)}
                                </span>
                              )}
                            </div>

                            {}
                            <div className="relative h-32">
                              <VerticalEqSlider
                                value={band.gain}
                                min={-12}
                                max={12}
                                onChange={(newValue) => {
                                  equalizer.updateBand(index, newValue);
                                }}
                                disabled={!equalizer.isEnabled}
                                isHovered={isHovered}
                                isAnimating={isAnimating}
                                isEnabled={equalizer.isEnabled}
                              />
                            </div>

                            {}
                            <span
                              className={`text-[10px] font-medium transition-all duration-200 sm:text-xs ${
                                isHovered
                                  ? "scale-110 text-[var(--color-text)]"
                                  : "text-[var(--color-subtext)]"
                              }`}
                            >
                              {formatFrequency(band.frequency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {}
                    <div className="mt-6 text-center">
                      <p className="text-xs text-[var(--color-muted)]">
                        Drag sliders to adjust • Range: -12dB to +12dB
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
