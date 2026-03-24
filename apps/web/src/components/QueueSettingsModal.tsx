"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SimilarityPreference } from "@starchild/types";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
  const t = useTranslations("queue");
  const tc = useTranslations("common");
  const similarityOptions: Array<{
    value: SimilarityPreference;
    label: string;
    description: string;
  }> = [
    {
      value: "strict",
      label: t("similarityStrict"),
      description: t("similarityStrictDescription"),
    },
    {
      value: "balanced",
      label: t("similarityBalanced"),
      description: t("similarityBalancedDescription"),
    },
    {
      value: "diverse",
      label: t("similarityDiverse"),
      description: t("similarityDiverseDescription"),
    },
  ];
  const [count, setCount] = useState(initialCount);
  const [similarityLevel, setSimilarityLevel] = useState<SimilarityPreference>(
    initialSimilarityLevel,
  );

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync form state from props when the dialog opens. */
  useEffect(() => {
    if (!isOpen) return;
    setCount(initialCount);
    setSimilarityLevel(initialSimilarityLevel);
  }, [initialCount, initialSimilarityLevel, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleApply = () => {
    onApply({ count, similarityLevel });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0">
        <div className="p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle>{t("settingsTitle")}</DialogTitle>
            <DialogDescription>{t("numberOfTracksHint")}</DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div>
              <label className="mb-3 block text-sm font-semibold text-[var(--color-text)]">
                {t("numberOfTracks")}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[rgba(255,255,255,0.1)] accent-[var(--color-accent)]"
                />
                <div className="w-12 text-center text-lg font-semibold text-[var(--color-text)]">
                  {count}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-[var(--color-text)]">
                {t("similarityLevel")}
              </label>
              <div className="space-y-2">
                {similarityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSimilarityLevel(option.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      similarityLevel === option.value
                        ? "border-[rgba(244,178,102,0.28)] bg-[rgba(244,178,102,0.1)]"
                        : "border-[color:var(--shell-border)] bg-[color:var(--shell-muted-bg)] hover:border-[rgba(244,178,102,0.16)] hover:bg-[rgba(244,178,102,0.05)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--color-text)]">
                        {option.label}
                      </span>
                      {similarityLevel === option.value ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-subtext)]">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              {t("apply")}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
