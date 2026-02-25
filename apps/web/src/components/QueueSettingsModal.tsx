// File: apps/web/src/components/QueueSettingsModal.tsx

"use client";

import { springPresets } from "@/utils/spring-animations";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { SimilarityPreference } from "@starchild/types";

export interface QueueSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: {
    count: number;
    similarityLevel: SimilarityPreference;
  }) => void;
  initialCount?: number;
  initialSimilarityLevel?: SimilarityPreference;
}

export function QueueSettingsModal({
  isOpen,
  onClose,
  onApply,
  initialCount = 5,
  initialSimilarityLevel = "balanced",
}: QueueSettingsModalProps) {
  const [mounted] = useState(() => typeof window !== "undefined");
  const [count, setCount] = useState(initialCount);
  const [similarityLevel, setSimilarityLevel] = useState<SimilarityPreference>(
    initialSimilarityLevel,
  );

  // Reset to initial values when modal opens - intentional sync pattern
  useEffect(() => {
    if (!isOpen) return;

    let frame: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const resetState = () => {
      setCount(initialCount);
      setSimilarityLevel(initialSimilarityLevel);
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      frame = requestAnimationFrame(resetState);
    } else {
      timeout = setTimeout(resetState, 0);
    }

    return () => {
      if (
        typeof frame === "number" &&
        typeof globalThis.cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(frame);
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isOpen, initialCount, initialSimilarityLevel]);

  const handleApply = () => {
    onApply({ count, similarityLevel });
    onClose();
  };

  const similarityOptions: Array<{
    value: SimilarityPreference;
    label: string;
    description: string;
  }> = [
    {
      value: "strict",
      label: "Strict",
      description: "Very similar tracks, mostly from track radio",
    },
    {
      value: "balanced",
      label: "Balanced",
      description: "Mix of similar tracks and related artists",
    },
    {
      value: "diverse",
      label: "Diverse",
      description: "Wide variety including genre exploration",
    },
  ];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springPresets.gentle}
            className="theme-chrome-backdrop fixed inset-0 z-[200] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={springPresets.gentle}
            className="fixed inset-x-4 top-1/2 z-[201] -translate-y-1/2 md:right-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="surface-panel overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-[var(--color-accent)]" />
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    Smart Tracks Settings
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(244,178,102,0.1)] text-[var(--color-accent)] transition-all hover:bg-[rgba(244,178,102,0.2)]"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6 p-6">
                {/* Track Count */}
                <div>
                  <label className="mb-3 block text-sm font-semibold text-[var(--color-text)]">
                    Number of Tracks
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[rgba(255,255,255,0.1)] accent-[var(--color-accent)]"
                    />
                    <div className="w-16 text-center text-lg font-bold text-[var(--color-accent)]">
                      {count}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-subtext)]">
                    Number of smart tracks to add to the queue
                  </p>
                </div>

                {/* Similarity Level */}
                <div>
                  <label className="mb-3 block text-sm font-semibold text-[var(--color-text)]">
                    Similarity Level
                  </label>
                  <div className="space-y-2">
                    {similarityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSimilarityLevel(option.value)}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          similarityLevel === option.value
                            ? "border-[var(--color-accent)] bg-[rgba(244,178,102,0.1)]"
                            : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)]"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-[var(--color-text)]">
                            {option.label}
                          </span>
                          {similarityLevel === option.value && (
                            <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-subtext)]">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.1)] px-6 py-4">
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-subtext)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] transition-all hover:scale-105 hover:bg-[var(--color-accent-strong)]"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
